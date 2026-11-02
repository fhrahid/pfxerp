import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CertificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';
import { CertificationsService } from '../certifications/certifications.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { AuthUser } from '../../common/types';
import { AppException } from '../../common/exceptions/app.exception';

/**
 * Paid 15-minute Consultancy (cto.md §8):
 * book (escrow 4000 from squad) -> complete (2000 consultant / 2000 reserve) -> cancel (>2h refund).
 * Weekly consultant velocity cap: 2 sessions.
 */
@Injectable()
export class ConsultancyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly certs: CertificationsService,
    private readonly dashboard: DashboardService,
  ) {}

  async book(user: AuthUser, dto: { consultantId: string; clientSquadId: string; scheduledAt: string }, idempotencyKey: string) {
    // Consultant must hold an active CONSULTANT certification (BR-CTO-39)
    await this.certs.assertCertified({ ...user, id: dto.consultantId, role: await this.roleOf(dto.consultantId) }, CertificationType.CONSULTANT);

    if (user.role === UserRole.PM) {
      const m = await this.prisma.squadMembership.findFirst({
        where: { userId: user.id, squadId: dto.clientSquadId, role: 'PM', leftAt: null },
      });
      if (!m) throw new ForbiddenException('Only the client squad PM may book consultancy');
    }

    const clientSquad = await this.prisma.squad.findUnique({ where: { id: dto.clientSquadId } });
    if (!clientSquad) throw new NotFoundException('Client squad not found');
    if (clientSquad.healthStatus === 'BANKRUPT_RISK') {
      throw new ForbiddenException('BANKRUPT_RISK: Squad treasury is frozen for non-essential consultancy bookings (BR-CFO-11)');
    }
    const tech = await this.dashboard.computeSquadTechScore(dto.clientSquadId, clientSquad.name);
    if (tech.tier === 'Tier F') {
      throw new ForbiddenException('Tier F Tech Score: consultancy bookings are frozen for this squad (cto.md §1.2)');
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt.getTime() < Date.now()) throw new BadRequestException('scheduledAt must be in the future');

    // BR-CTO-44: weekly consultant cap (2 sessions, ISO week window)
    const cap = await this.settings.getNumber('MAX_CONSULTANCY_SESSIONS_PER_USER_PER_WEEK', 2);
    const weekStart = new Date(scheduledAt);
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7)); // Monday
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekCount = await this.prisma.consultancyBooking.count({
      where: {
        consultantId: dto.consultantId,
        status: { in: ['SCHEDULED', 'COMPLETED'] },
        scheduledAt: { gte: weekStart, lt: weekEnd },
      },
    });
    if (weekCount >= cap) throw new AppException('CONSULT_CAP_EXCEEDED', `Consultant reached the weekly limit of ${cap} sessions`);

    const fee = await this.settings.getNumber('CONSULTANCY_FEE', 4000);
    const cutRate = await this.settings.getNumber('CTO_CONSULTANCY_CUT_RATE', 0.50);
    const consultantCut = Math.round(fee * cutRate * 100) / 100;

    const treasury = await this.ledger.squadTreasury(dto.clientSquadId);
    const escrow = await this.ledger.escrow();

    await this.ledger.executeDoubleEntryTransfer({
      senderAccountId: treasury.id,
      recipientAccountId: escrow.id,
      amount: fee,
      referenceType: 'ESCROW_DEPOSIT',
      description: `Consultancy booking escrow — consultant ${dto.consultantId}`,
      idempotencyKey: idempotencyKey || `consult_${dto.consultantId}_${Date.now()}`,
      authorizedById: user.id,
    });

    return this.prisma.consultancyBooking.create({
      data: {
        consultantId: dto.consultantId,
        clientSquadId: dto.clientSquadId,
        bookedById: user.id,
        fee,
        consultantCut,
        scheduledAt,
        status: 'SCHEDULED',
      },
    });
  }

  /** API-CTO-23: notes >= 50 words + >= 1 PR link settle the escrow. */
  async complete(consultantUserId: string, bookingId: string, dto: { meetingNotes: string; prLinks: string }) {
    const booking = await this.prisma.consultancyBooking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'SCHEDULED') throw new BadRequestException('Booking is not scheduled');
    if (booking.consultantId !== consultantUserId) throw new ForbiddenException('Only the assigned consultant may complete this session');

    const wordCount = dto.meetingNotes.trim().split(/\s+/).length;
    if (wordCount < 50) throw new BadRequestException(`meetingNotes must contain at least 50 words (got ${wordCount}) — BR-CTO-43`);
    const links = dto.prLinks.split(/[\n,]/).map((s) => s.trim()).filter((s) => s.length > 8);
    if (links.length === 0) throw new BadRequestException('At least one actionable PR/repository link is required — BR-CTO-43');

    const fee = Number(booking.fee);
    const consultantCut = Number(booking.consultantCut);
    const reserveShare = fee - consultantCut;

    const escrow = await this.ledger.escrow();
    const consultantWallet = await this.ledger.personalWallet(consultantUserId);
    const reserve = await this.ledger.systemReserve();

    await this.ledger.postTransaction({
      entries: [
        { accountId: escrow.id, direction: 'DEBIT', amount: fee },
        { accountId: consultantWallet.id, direction: 'CREDIT', amount: consultantCut },
        { accountId: reserve.id, direction: 'CREDIT', amount: reserveShare },
      ],
      referenceType: 'CONSULTANCY',
      referenceId: booking.id,
      description: `Consultancy settlement — booking ${booking.id}`,
      idempotencyKey: `consult_settle_${booking.id}`,
      authorizedById: consultantUserId,
    });

    return this.prisma.consultancyBooking.update({
      where: { id: bookingId },
      data: {
        status: 'COMPLETED',
        meetingNotes: dto.meetingNotes,
        prLinks: links.join('\n'),
        completedAt: new Date(),
      },
    });
  }

  /** Cancellation > 2h before start refunds 100% of the escrow. */
  async cancel(user: AuthUser, bookingId: string) {
    const booking = await this.prisma.consultancyBooking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'SCHEDULED') throw new BadRequestException('Booking is not scheduled');

    const hoursToStart = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000;
    if (hoursToStart <= 2) {
      throw new BadRequestException('Sessions may only be cancelled more than 2 hours in advance');
    }

    const escrow = await this.ledger.escrow();
    const treasury = await this.ledger.squadTreasury(booking.clientSquadId);
    await this.ledger.executeDoubleEntryTransfer({
      senderAccountId: escrow.id,
      recipientAccountId: treasury.id,
      amount: Number(booking.fee),
      referenceType: 'ESCROW_RELEASE',
      referenceId: booking.id,
      description: `Consultancy cancellation refund — booking ${booking.id}`,
      idempotencyKey: `consult_refund_${booking.id}`,
      authorizedById: user.id,
    });

    return this.prisma.consultancyBooking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });
  }

  async list(filters: { consultantId?: string; clientSquadId?: string; status?: string }) {
    return this.prisma.consultancyBooking.findMany({
      where: {
        ...(filters.consultantId ? { consultantId: filters.consultantId } : {}),
        ...(filters.clientSquadId ? { clientSquadId: filters.clientSquadId } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
      },
      orderBy: { scheduledAt: 'desc' },
      take: 100,
      include: {
        consultant: { select: { id: true, fullName: true, role: true } },
        clientSquad: { select: { id: true, name: true } },
      },
    });
  }

  private async roleOf(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException('Consultant not found');
    return u.role;
  }
}
