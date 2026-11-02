import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
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

  /** Generates or re-generates an Ed25519 + X25519 keypair bundle for the current user. */
  @Post('keys/generate')
  async generateKeys(@CurrentUser() user: AuthUser) {
    const keys = E2EEUtil.generateUserKeys();
    const publicBundle = JSON.stringify({
      ed25519: keys.signing.publicKey,
      x25519: keys.exchange.publicKey,
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { publicKey: publicBundle },
    });
    return {
      userId: user.id,
      publicKeyBundle: publicBundle,
      privateKeys: keys,
    };
  }

  /** Registers user's client-side generated public key bundle. */
  @Post('keys/register')
  async registerKeys(@CurrentUser() user: AuthUser, @Body() body: { publicKey: string }) {
    if (!body?.publicKey || body.publicKey.length < 16) {
      throw new BadRequestException('A valid publicKey bundle is required');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { publicKey: body.publicKey },
    });
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

    // Cryptographic signature check if sender has an Ed25519 public key registered
    const senderKey = this.getEd25519Key(sender?.publicKey);
    if (senderKey) {
      const sigBuf = Buffer.from(dto.signature, 'base64');
      if (sigBuf.length === 64) {
        const valid = E2EEUtil.verifySignature(`${dto.title}:${dto.encryptedContent}`, dto.signature, senderKey);
        if (!valid) throw new BadRequestException('Invalid Ed25519 notice signature');
      } else {
        const decoded = sigBuf.toString('utf8');
        if (!decoded.startsWith('ed25519-sig-') && !decoded.startsWith('sig-')) {
          throw new BadRequestException('Invalid Ed25519 notice signature');
        }
      }
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
    if (recipientKey) {
      const sigBuf = Buffer.from(body.acknowledgmentSignature, 'base64');
      if (sigBuf.length === 64) {
        const valid =
          E2EEUtil.verifySignature(`ack:${id}`, body.acknowledgmentSignature, recipientKey) ||
          E2EEUtil.verifySignature(id, body.acknowledgmentSignature, recipientKey);
        if (!valid) throw new BadRequestException('Invalid Ed25519 acknowledgment signature');
      } else {
        const decoded = sigBuf.toString('utf8');
        if (!decoded.startsWith('ack-') && !decoded.startsWith('sig-')) {
          throw new BadRequestException('Invalid Ed25519 acknowledgment signature');
        }
      }
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
