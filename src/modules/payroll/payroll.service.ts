import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PayrollTier, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';
import { EventsGateway } from '../../events/events.gateway';
import { AuthUser, isExecRole, isBoardRole, isOverrideRole } from '../../common/types';
import { AppException } from '../../common/exceptions/app.exception';

const TIER_CAPS: Record<PayrollTier, number> = {
  STAR_PERFORMER: 3500,
  REGULAR: 2000,
  UNDERPERFORMER: 1000,
  SLACKER: 0,
};

/**
 * Weekly Lab Payroll Engine (chro.md §2.2, pm.md §5):
 * PM proposes -> CHRO audits -> atomic batch disbursement from SQUAD_TREASURY to wallets.
 * Also hosts the Slacker Fine enforcement (chro.md §2.4).
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly events: EventsGateway,
  ) {}

  async submitProposal(user: AuthUser, dto: { squadId: string; labNumber: number; sprintNumber?: number; lineItems: { userId: string; tier: PayrollTier; amount: number; justification?: string }[] }) {
    // Only the squad PM proposes payroll
    const membership = await this.prisma.squadMembership.findFirst({
      where: { userId: user.id, squadId: dto.squadId, role: 'PM', leftAt: null },
    });
    if (!membership && user.role !== UserRole.CEO) {
      throw new ForbiddenException('Only the squad PM may submit payroll proposals');
    }

    const budget = await this.settings.getNumber('WEEKLY_LAB_BUDGET', 10000);
    const total = dto.lineItems.reduce((a, i) => a + i.amount, 0);
    if (total > budget) {
      throw new AppException('PAYROLL_EXCEEDS_BUDGET', `Total ${total} exceeds the BDT ${budget} lab budget (BR-CHRO-07)`);
    }
    if (new Set(dto.lineItems.map((i) => i.userId)).size !== dto.lineItems.length) {
      throw new BadRequestException('Duplicate line items for the same user');
    }

    // Validate membership + tier caps
    for (const item of dto.lineItems) {
      const cap = TIER_CAPS[item.tier];
      if (item.amount > cap) {
        throw new BadRequestException(`PAYROLL_EXCEEDS_BUDGET: tier ${item.tier} capped at BDT ${cap} (BR-PM-08)`);
      }
      const m = await this.prisma.squadMembership.findFirst({
        where: { userId: item.userId, squadId: dto.squadId, leftAt: null },
      });
      if (!m) throw new BadRequestException(`User ${item.userId} is not an active member of the squad`);
    }

    const existing = await this.prisma.payrollProposal.findUnique({
      where: { squadId_labNumber: { squadId: dto.squadId, labNumber: dto.labNumber } },
    });
    if (existing) throw new ConflictException('A payroll proposal already exists for this lab (BR-CHRO-10)');

    const proposal = await this.prisma.payrollProposal.create({
      data: {
        squadId: dto.squadId,
        labNumber: dto.labNumber,
        sprintNumber: dto.sprintNumber ?? (await this.settings.currentSprint()),
        totalProposed: total,
        status: 'SUBMITTED',
        submittedById: user.id,
        lineItems: {
          create: dto.lineItems.map((i) => ({
            userId: i.userId,
            tier: i.tier,
            amount: i.amount,
            justification: i.justification,
          })),
        },
      },
      include: { lineItems: true },
    });

    return { proposalId: proposal.id, totalProposed: total, status: proposal.status };
  }

  async listProposals(user: AuthUser, status?: string) {
    const isExec = user.role === UserRole.CEO || user.role === UserRole.CPO;
    return this.prisma.payrollProposal.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(isExec ? {} : { squadId: { in: user.squadIds.length ? user.squadIds : ['none'] } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        squad: { select: { id: true, name: true } },
        lineItems: { include: { user: { select: { id: true, fullName: true, tier: true } } } },
      },
    });
  }

  /** API-CHRO-02: approve + atomic batch disbursement (idempotent replay per main.md §7.3). */
  async approveAndDisburse(cpoUserId: string, proposalId: string, idempotencyKey: string) {
    const replayKey = idempotencyKey || `payroll_${proposalId}`;

    // Idempotent replay: if this exact key already settled the ledger, return the original outcome
    const existingTx = await this.prisma.ledgerTransaction.findUnique({
      where: { idempotencyKey: replayKey },
      include: { entries: true },
    });
    if (existingTx && existingTx.referenceId === proposalId) {
      const credits = existingTx.entries.filter((e) => e.direction === 'CREDIT');
      return {
        proposalId,
        status: 'APPROVED',
        disbursedAmount: credits.reduce((a, e) => a + Number(e.amount), 0),
        recipientsCount: new Set(credits.map((e) => e.accountId)).size,
        executedAt: existingTx.createdAt,
        replayed: true,
      };
    }

    const proposal = await this.prisma.payrollProposal.findUnique({
      where: { id: proposalId },
      include: { squad: { include: { account: true } }, lineItems: { include: { user: { include: { account: true } } } } },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== 'SUBMITTED') {
      throw new AppException('PAYROLL_ALREADY_APPROVED', `Proposal is ${proposal.status}`);
    }
    if (!proposal.squad.account) throw new BadRequestException('Squad treasury account missing');

    const paidItems = proposal.lineItems.filter((i) => Number(i.amount) > 0);
    for (const item of paidItems) {
      if (!item.user.account) throw new BadRequestException(`User ${item.userId} has no personal wallet`);
    }

    const total = Number(proposal.totalProposed);
    const treasury = await this.ledger.squadTreasury(proposal.squadId);

    await this.ledger.postTransaction({
      entries: [
        { accountId: treasury.id, direction: 'DEBIT', amount: total },
        ...paidItems.map((i) => ({
          accountId: i.user.account!.id,
          direction: 'CREDIT' as const,
          amount: Number(i.amount),
        })),
      ],
      referenceType: 'PAYROLL',
      referenceId: proposal.id,
      description: `Lab ${proposal.labNumber} payroll batch for ${proposal.squad.name}`,
      idempotencyKey: replayKey,
      authorizedById: cpoUserId,
    });

    const updated = await this.prisma.payrollProposal.update({
      where: { id: proposalId },
      data: { status: 'APPROVED', approvedById: cpoUserId },
    });

    this.events.emitToRoom(this.events.squadRoom(proposal.squadId), 'payroll:executed', {
      proposalId: proposal.id,
      labNumber: proposal.labNumber,
      totalDisbursed: total,
    });

    return {
      proposalId: updated.id,
      status: updated.status,
      disbursedAmount: total,
      recipientsCount: paidItems.length,
      executedAt: updated.updatedAt,
    };
  }

  async reject(cpoUserId: string, proposalId: string, reason: string) {
    const proposal = await this.prisma.payrollProposal.findUnique({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== 'SUBMITTED') throw new AppException('PAYROLL_ALREADY_APPROVED');
    return this.prisma.payrollProposal.update({
      where: { id: proposalId },
      data: { status: 'REJECTED', rejectedReason: reason, approvedById: cpoUserId },
    });
  }

  /** API-CHRO-04: slacker fine — BDT 2000 split CPO 500 / reserve 1500 (BR-CHRO-16..19). */
  async issueSlackerFine(cpoUserId: string, dto: { targetUserId: string; targetSquadId: string; reason: string }, idempotencyKey: string) {
    const fine = await this.settings.getNumber('SLACKER_FINE', 2000);
    const cpoCut = await this.settings.getNumber('CPO_SLACKER_CUT', 500);
    const reserveCut = fine - cpoCut;

    const wallet = await this.prisma.account.findUnique({ where: { ownerId: dto.targetUserId } });
    const treasury = await this.ledger.squadTreasury(dto.targetSquadId);
    if (!wallet) throw new BadRequestException('Target user wallet missing');

    // BR-CHRO-19: deduct from wallet; shortfall charged to the squad treasury
    const walletBalance = Number(wallet.balance);
    const fromWallet = Math.max(0, Math.min(walletBalance, fine));
    const fromSquad = fine - fromWallet;

    const entries: { accountId: string; direction: 'DEBIT' | 'CREDIT'; amount: number }[] = [];
    if (fromWallet > 0) entries.push({ accountId: wallet.id, direction: 'DEBIT', amount: fromWallet });
    if (fromSquad > 0) entries.push({ accountId: treasury.id, direction: 'DEBIT', amount: fromSquad });
    entries.push({ accountId: (await this.ledger.personalWallet(cpoUserId)).id, direction: 'CREDIT', amount: cpoCut });
    entries.push({ accountId: (await this.ledger.systemReserve()).id, direction: 'CREDIT', amount: reserveCut });

    await this.ledger.postTransaction({
      entries,
      referenceType: 'SLACKER_FINE',
      referenceId: dto.targetUserId,
      description: `Slacker fine: ${dto.reason.slice(0, 120)}`,
      idempotencyKey: idempotencyKey || `slacker_${dto.targetUserId}_${Date.now()}`,
      authorizedById: cpoUserId,
    });

    // DPI 0-band: mark the developer's snapshot toward SLACKER territory
    const sprint = await this.settings.currentSprint();
    await this.prisma.developerPerformanceSnapshot.upsert({
      where: { userId_sprintNumber: { userId: dto.targetUserId, sprintNumber: sprint } },
      update: { dpiScore: 0 },
      create: { userId: dto.targetUserId, sprintNumber: sprint, dpiScore: 0 },
    });

    return {
      fineAmount: fine,
      cpoBounty: cpoCut,
      reserveDeposit: reserveCut,
      chargedToWallet: fromWallet,
      chargedToSquadTreasury: fromSquad,
      issuedAt: new Date().toISOString(),
    };
  }
}
