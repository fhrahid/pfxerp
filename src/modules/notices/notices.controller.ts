import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { NoticeCategory, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../events/events.gateway';

class DispatchNoticeDto {
  @IsUUID()
  recipientId: string;

  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(16)
  encryptedContent: string; // base64 AES-256-GCM ciphertext (client-side encrypted)

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

  /** API-CHRO-03. */
  @Post()
  @Roles(UserRole.CPO, UserRole.CEO)
  async dispatch(@Body() dto: DispatchNoticeDto, @CurrentUser() user: AuthUser) {
    const recipient = await this.prisma.user.findUnique({ where: { id: dto.recipientId } });
    if (!recipient) throw new BadRequestException('Recipient not found');

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
      include: { sender: { select: { id: true, fullName: true, role: true } } },
    });
  }

  /** BR-CHRO-15: signed acknowledgment receipt. */
  @Post(':id/acknowledge')
  async acknowledge(@Param('id') id: string, @Body() body: { acknowledgmentSignature: string }, @CurrentUser() user: AuthUser) {
    if (!body?.acknowledgmentSignature || body.acknowledgmentSignature.length < 16) {
      throw new BadRequestException('A valid acknowledgment signature is required');
    }
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new BadRequestException('Notice not found');
    if (notice.recipientId !== user.id) throw new ForbiddenException('AUTHZ_NOT_OWNER');
    if (notice.status === 'ACKNOWLEDGED') throw new BadRequestException('Notice already acknowledged');

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
