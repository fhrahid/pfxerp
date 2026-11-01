import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BugSeverity, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';
import { EventsGateway } from '../../events/events.gateway';
import { AuthUser } from '../../common/types';
import { AppException } from '../../common/exceptions/app.exception';

/**
 * Adversarial Bug Bounty Arena (cto.md §6, dev.md §4):
 *  - targets escrow their pool from the squad treasury into the studio ESCROW account
 *  - cross-squad hunters report; the CTO is the sole triage authority
 *  - anti-exploit: self-squad block, 2-sprint cooldown, 5 claims/sprint, 25% drain cap
 */
@Injectable()
export class BountyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly events: EventsGateway,
  ) {}

  async createTarget(user: AuthUser, dto: { title: string; description?: string; targetSquadId: string; totalBountyPool: number; clientMilestoneId?: string }) {
    if (user.role === UserRole.PM) {
      const m = await this.prisma.squadMembership.findFirst({
        where: { userId: user.id, squadId: dto.targetSquadId, leftAt: null },
      });
      if (!m) throw new ForbiddenException('PMs may only fund targets for their own squad');
    }

    if (dto.totalBountyPool < 5000) {
      throw new BadRequestException('totalBountyPool must be at least 5000 (API-CTO-11)');
    }

    const treasury = await this.ledger.squadTreasury(dto.targetSquadId);
    const escrow = await this.ledger.escrow();

    await this.ledger.executeDoubleEntryTransfer({
      senderAccountId: treasury.id,
      recipientAccountId: escrow.id,
      amount: dto.totalBountyPool,
      referenceType: 'ESCROW_DEPOSIT',
      description: `Bug bounty pool escrow — ${dto.title}`,
      idempotencyKey: `bounty_pool_${dto.targetSquadId}_${Date.now()}`,
      authorizedById: user.id,
    });

    return this.prisma.bugBountyTarget.create({
      data: {
        title: dto.title,
        description: dto.description,
        targetSquadId: dto.targetSquadId,
        clientMilestoneId: dto.clientMilestoneId,
        totalBountyPool: dto.totalBountyPool,
        remainingPool: dto.totalBountyPool,
        createdById: user.id,
      },
    });
  }

  async listTargets(activeOnly = true) {
    const targets = await this.prisma.bugBountyTarget.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        targetSquad: { select: { id: true, name: true } },
        _count: { select: { reports: { where: { status: 'SUBMITTED' } } } },
      },
    });
    return targets.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      targetSquadId: t.targetSquadId,
      targetSquadName: t.targetSquad.name,
      totalBountyPool: Number(t.totalBountyPool),
      remainingPool: Number(t.remainingPool),
      openBugCount: t._count.reports,
      isActive: t.isActive,
      createdAt: t.createdAt,
    }));
  }

  async submitReport(user: AuthUser, dto: { bountyTargetId?: string; targetSquadId: string; title: string; description: string; reproductionSteps: string; severity: BugSeverity; proofOfConceptUrl?: string }) {
    if (dto.description.length < 20) throw new BadRequestException('Description must be at least 20 characters');
    if (dto.reproductionSteps.length < 30) throw new BadRequestException('Reproduction steps must be at least 30 characters');

    // Resolve the hunter's primary squad
    const membership = await this.prisma.squadMembership.findFirst({
      where: { userId: user.id, leftAt: null },
      orderBy: [{ isPrimary: 'desc' }, { joinedAt: 'asc' }],
    });
    if (!membership) throw new ForbiddenException('Hunter must belong to an active squad');

    // BR-CTO-26 / BR-DEV-09: cross-squad rule
    if (membership.squadId === dto.targetSquadId) {
      throw new AppException('BOUNTY_SELF_SQUAD');
    }
    const cooldownSprints = await this.settings.getNumber('CROSS_SQUAD_BOUNTY_COOLDOWN_SPRINTS', 2);
    const cooldownMs = cooldownSprints * 7 * 24 * 60 * 60 * 1000;
    const prior = await this.prisma.squadMembership.findFirst({
      where: {
        userId: user.id,
        squadId: dto.targetSquadId,
        leftAt: { not: null, gte: new Date(Date.now() - cooldownMs) },
      },
    });
    if (prior) throw new AppException('BOUNTY_COOLDOWN');

    // BR-CTO-30: hunter velocity cap (submitted reports this sprint)
    const sprint = await this.settings.currentSprint();
    const cap = await this.settings.getNumber('MAX_BUG_BOUNTY_CLAIMS_PER_USER_PER_SPRINT', 5);
    const submitted = await this.prisma.bugReport.count({
      where: { reportingUserId: user.id, sprintNumber: sprint },
    });
    if (submitted >= cap) throw new AppException('BOUNTY_CAP_EXCEEDED');

    return this.prisma.bugReport.create({
      data: {
        bountyTargetId: dto.bountyTargetId,
        reportingUserId: user.id,
        reportingSquadId: membership.squadId,
        targetSquadId: dto.targetSquadId,
        title: dto.title,
        description: dto.description,
        reproductionSteps: dto.reproductionSteps,
        severity: dto.severity,
        status: 'SUBMITTED',
        sprintNumber: sprint,
      },
    });
  }

  async listReports(filters: { targetSquadId?: string; status?: string; severity?: string }) {
    return this.prisma.bugReport.findMany({
      where: {
        ...(filters.targetSquadId ? { targetSquadId: filters.targetSquadId } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.severity ? { severity: filters.severity as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        reportingUser: { select: { id: true, fullName: true } },
        reportingSquad: { select: { id: true, name: true } },
        targetSquad: { select: { id: true, name: true } },
      },
    });
  }

  /** API-CTO-15: CTO triage — VERIFY pays from escrow, REJECT records feedback. */
  async triage(ctoUserId: string, reportId: string, dto: { action: 'VERIFY' | 'REJECT'; severity?: BugSeverity; notes?: string }) {
    const report = await this.prisma.bugReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== 'SUBMITTED') throw new BadRequestException('Report already triaged');

    if (dto.action === 'REJECT') {
      return this.prisma.bugReport.update({
        where: { id: reportId },
        data: { status: 'REJECTED', rejectionReason: dto.notes || 'Rejected by CTO triage', verifiedByCtoId: ctoUserId, verifiedAt: new Date() },
      });
    }

    const severity = dto.severity || report.severity;
    const amount = await this.bountyFor(severity);

    // Pool cap (BR-CTO-24)
    if (report.bountyTargetId) {
      const target = await this.prisma.bugBountyTarget.findUnique({ where: { id: report.bountyTargetId } });
      if (target && Number(target.remainingPool) < amount) {
        throw new AppException('BOUNTY_POOL_DEPLETED', `Remaining pool ${Number(target.remainingPool)} < bounty ${amount}`);
      }
    }

    // BR-CTO-31: target drain cap (25% of treasury per sprint)
    const drainCapRate = await this.settings.getNumber('BUG_BOUNTY_CAP_PERCENT_OF_TARGET_BALANCE', 0.25);
    const treasury = await this.ledger.squadTreasury(report.targetSquadId);
    const sprint = report.sprintNumber ?? (await this.settings.currentSprint());
    const paidThisSprint = await this.prisma.bugReport.aggregate({
      where: { targetSquadId: report.targetSquadId, status: 'CTO_VERIFIED', sprintNumber: sprint },
      _sum: { bountyAmount: true },
    });
    const alreadyPaid = Number(paidThisSprint._sum.bountyAmount || 0);
    const treasuryOpening = alreadyPaid + Number(treasury.balance);
    if (alreadyPaid + amount > treasuryOpening * drainCapRate) {
      throw new AppException('BOUNTY_CAP_EXCEEDED', 'Target squad bounty drain cap (25%/sprint) reached; claim deferred');
    }

    // Pay: ESCROW -> hunter squad treasury
    const escrow = await this.ledger.escrow();
    const hunterTreasury = await this.ledger.squadTreasury(report.reportingSquadId);
    await this.ledger.executeDoubleEntryTransfer({
      senderAccountId: escrow.id,
      recipientAccountId: hunterTreasury.id,
      amount,
      referenceType: 'BOUNTY',
      referenceId: report.id,
      description: `${severity} bug bounty payout — report ${report.id}`,
      idempotencyKey: `bounty_${report.id}`,
      authorizedById: ctoUserId,
    });

    if (report.bountyTargetId) {
      await this.prisma.bugBountyTarget.update({
        where: { id: report.bountyTargetId },
        data: { remainingPool: { decrement: amount } },
      });
    }

    const updated = await this.prisma.bugReport.update({
      where: { id: reportId },
      data: {
        status: 'CTO_VERIFIED',
        severity,
        bountyAmount: amount,
        verifiedByCtoId: ctoUserId,
        verifiedAt: new Date(),
      },
    });

    // Elevate hunter DPI (BR-DEV-13)
    await this.prisma.developerPerformanceSnapshot.upsert({
      where: { userId_sprintNumber: { userId: report.reportingUserId, sprintNumber: sprint } },
      update: { bugBountyContributions: { increment: 1 }, dpiScore: { increment: 2 } },
      create: { userId: report.reportingUserId, sprintNumber: sprint, dpiScore: 102, bugBountyContributions: 1 },
    });

    this.events.emitToStudio('bounty:verified', {
      reportId: report.id,
      severity,
      bountyAmount: amount,
      hunterSquadId: report.reportingSquadId,
      targetSquadId: report.targetSquadId,
    });

    return { ...updated, bountyPaid: amount, transactionRef: `bounty_${report.id}` };
  }

  private async bountyFor(severity: BugSeverity): Promise<number> {
    switch (severity) {
      case 'CRITICAL':
        return this.settings.getNumber('CRITICAL_BUG_BOUNTY', 5000);
      case 'MAJOR':
        return this.settings.getNumber('MAJOR_BUG_BOUNTY', 3000);
      case 'MINOR':
        return this.settings.getNumber('MINOR_BUG_BOUNTY', 1000);
      default:
        return this.settings.getNumber('LOW_BUG_BOUNTY', 500);
    }
  }
}
