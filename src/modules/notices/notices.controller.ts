import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { createPublicKey } from 'crypto';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { NoticeCategory, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import { E2EEUtil } from '../../common/crypto/e2ee.util';

class DispatchNoticeDto {
  @IsUUID()
  recipientId: string;

  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(16)
  encryptedContent: string; // base64 AES-256-GCM ciphertext (client-side encrypted with recipient X25519)

  @IsEnum(NoticeCategory)
  category: NoticeCategory;

  @IsString()
  @MinLength(16)
  signature: string; // base64 Ed25519 signature
}

/**
 * Zero-knowledge notice system (chro.md §2.3, security.md §6).
 * The server stores only ciphertext + signatures; it can never read notice bodies.
 */
@ApiTags('notices')
@ApiBearerAuth()
@Controller('notices')
export class NoticesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  private getEd25519Key(raw?: string | null): string | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed.ed25519 || parsed.signing || null;
    } catch {
      return raw.startsWith('MCow') ? raw : null;
    }
  }

  private assertEncryptedEnvelope(value: string) {
    try {
      const envelope = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
      const ephemeralKey = createPublicKey({
        key: Buffer.from(envelope.ephemPk || '', 'base64'),
        format: 'der',
        type: 'spki',
      });
      if (
        envelope.alg !== 'X25519-AES256GCM' ||
        ephemeralKey.asymmetricKeyType !== 'x25519' ||
        Buffer.from(envelope.iv || '', 'base64').length !== 12 ||
        Buffer.from(envelope.data || '', 'base64').length < 16
      ) throw new Error('Invalid envelope');
    } catch {
      throw new BadRequestException('encryptedContent must be a valid X25519/AES-256-GCM envelope');
    }
  }

  /** Registers only keys generated and retained by the user's client. */
  @Post('keys/register')
  async registerKeys(@CurrentUser() user: AuthUser, @Body() body: { publicKey: string }) {
    let bundle: { ed25519?: string; x25519?: string };
    try {
      bundle = JSON.parse(body?.publicKey || '');
      for (const [type, key] of [['ed25519', bundle.ed25519], ['x25519', bundle.x25519]] as const) {
        const parsed = createPublicKey({ key: Buffer.from(key || '', 'base64'), format: 'der', type: 'spki' });
        if (parsed.asymmetricKeyType !== type) throw new Error('Wrong key type');
      }
    } catch {
      throw new BadRequestException('A valid Ed25519 and X25519 public key bundle is required');
    }
    const current = await this.prisma.user.findUnique({ where: { id: user.id }, select: { publicKey: true } });
    if (current?.publicKey && current.publicKey !== body.publicKey) {
      throw new ConflictException('Notice keys are already registered and cannot be replaced through this endpoint');
    }
    const registered = await this.prisma.user.updateMany({
      where: { id: user.id, publicKey: current?.publicKey ?? null },
      data: { publicKey: body.publicKey },
    });
    if (!registered.count) {
      const latest = await this.prisma.user.findUnique({ where: { id: user.id }, select: { publicKey: true } });
      if (latest?.publicKey !== body.publicKey) {
        throw new ConflictException('Notice keys changed during registration; reload and try again');
      }
    }
    return { registered: true, userId: user.id };
  }

  /** Returns recipient's public key for client-side X25519 encryption. */
  @Get('keys/:userId')
  async getUserPublicKey(@Param('userId') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, publicKey: true },
    });
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  /** API-CHRO-03: dispatch encrypted notice with Ed25519 signature verification. */
  @Post()
  @Roles(UserRole.CPO, UserRole.CEO)
  async dispatch(@Body() dto: DispatchNoticeDto, @CurrentUser() user: AuthUser) {
    const [recipient, sender] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.recipientId } }),
      this.prisma.user.findUnique({ where: { id: user.id } }),
    ]);
    if (!recipient) throw new BadRequestException('Recipient not found');
    this.assertEncryptedEnvelope(dto.encryptedContent);

    // Every notice must carry a valid Ed25519 signature from a registered sender key.
    const senderKey = this.getEd25519Key(sender?.publicKey);
    if (!senderKey || Buffer.from(dto.signature, 'base64').length !== 64 ||
        !E2EEUtil.verifySignature(
          JSON.stringify([dto.recipientId, dto.title, dto.category, dto.encryptedContent]),
          dto.signature,
          senderKey,
        )) {
      throw new BadRequestException('A valid Ed25519 signature and registered sender key are required');
    }

    const notice = await this.prisma.notice.create({
      data: {
        senderId: user.id,
        recipientId: dto.recipientId,
        title: dto.title,
        encryptedContent: dto.encryptedContent,
        category: dto.category,
        signature: dto.signature,
        status: 'DISPATCHED',
      },
    });

    this.events.emitToRoom(this.events.userRoom(dto.recipientId), 'notice:incoming', {
      id: notice.id,
      title: notice.title,
      category: notice.category,
      encryptedContent: notice.encryptedContent,
      signature: notice.signature,
    });

    return { noticeId: notice.id, status: notice.status, dispatchedAt: notice.createdAt };
  }

  /** Recipients see only their own notices (dev.md §1.1). */
  @Get()
  async inbox(@CurrentUser() user: AuthUser, @Query('category') category?: NoticeCategory) {
    return this.prisma.notice.findMany({
      where: { recipientId: user.id, ...(category ? { category } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { sender: { select: { id: true, fullName: true, role: true, publicKey: true } } },
    });
  }

  /** BR-CHRO-15: signed acknowledgment receipt with Ed25519 verification. */
  @Post(':id/acknowledge')
  async acknowledge(@Param('id') id: string, @Body() body: { acknowledgmentSignature: string }, @CurrentUser() user: AuthUser) {
    if (!body?.acknowledgmentSignature || body.acknowledgmentSignature.length < 16) {
      throw new BadRequestException('A valid acknowledgment signature is required');
    }
    const [notice, recipient] = await Promise.all([
      this.prisma.notice.findUnique({ where: { id } }),
      this.prisma.user.findUnique({ where: { id: user.id } }),
    ]);
    if (!notice) throw new BadRequestException('Notice not found');
    if (notice.recipientId !== user.id) throw new ForbiddenException('AUTHZ_NOT_OWNER');
    if (notice.status === 'ACKNOWLEDGED') throw new BadRequestException('Notice already acknowledged');

    const recipientKey = this.getEd25519Key(recipient?.publicKey);
    const signature = body.acknowledgmentSignature;
    if (!recipientKey || Buffer.from(signature, 'base64').length !== 64 ||
        !E2EEUtil.verifySignature(`ack:${id}`, signature, recipientKey)) {
      throw new BadRequestException('A valid Ed25519 acknowledgment signature and registered recipient key are required');
    }

    const updated = await this.prisma.notice.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgmentSignature: body.acknowledgmentSignature,
      },
    });
    return { noticeId: updated.id, status: updated.status, acknowledgedAt: updated.acknowledgedAt };
  }
}
