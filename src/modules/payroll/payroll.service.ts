import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FineTargetType, PayrollTier, UserRole } from '@prisma/client';
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

  async proposeFine(actor: AuthUser, dto: { targetType: FineTargetType; targetSquadId?: string; targetUserId?: string; amount: number; reason: string }) {
    if (!( [UserRole.CPO, UserRole.CTO, UserRole.CEO] as string[]).includes(actor.role)) throw new ForbiddenException('Only CPO, CTO or CEO may propose a fine');
    if (!Number.isFinite(dto.amount) || dto.amount <= 0 || dto.amount > 50000 || Math.abs(dto.amount * 100 - Math.round(dto.amount * 100)) > 1e-7) {
      throw new BadRequestException('Fine amount must be between BDT 0.01 and 50,000.00 with at most two decimals');
    }
    if (!dto.reason?.trim() || dto.reason.trim().length < 10) throw new BadRequestException('Provide a reason of at least 10 characters');

    let targetSquadId: string | null = null;
    let targetUserId: string | null = null;
    if (dto.targetType === FineTargetType.SQUAD) {
      if (!dto.targetSquadId || dto.targetUserId) throw new BadRequestException('Select exactly one squad target');
      const squad = await this.prisma.squad.findUnique({ where: { id: dto.targetSquadId } });
      if (!squad || !squad.isActive) throw new BadRequestException('Active squad not found');
      await this.ledger.squadTreasury(squad.id);
      targetSquadId = squad.id;
    } else {
      if (!dto.targetUserId || dto.targetSquadId) throw new BadRequestException('Select exactly one person target');
      const target = await this.prisma.user.findUnique({ where: { id: dto.targetUserId } });
      if (!target || !target.isActive || !([UserRole.PM, UserRole.DEVELOPER] as string[]).includes(target.role)) {
        throw new BadRequestException('Target must be an active PM or developer');
      }
      await this.ledger.personalWallet(target.id);
      targetUserId = target.id;
    }

    const proposal = await this.prisma.fineProposal.create({
      data: {
        targetType: dto.targetType, targetSquadId, targetUserId,
        proposedById: actor.id, amount: dto.amount, reason: dto.reason.trim(),
      },
      include: {
        targetSquad: { select: { id: true, name: true } },
        targetUser: { select: { id: true, fullName: true, role: true } },
      },
    });
    await this.prisma.executiveAuditLog.create({
      data: {
        executiveId: actor.id, executiveRole: actor.role as UserRole,
        actionType: 'FINE_PROPOSED', riskSeverity: 'WARNING',
        payloadSnapshot: { fineProposalId: proposal.id, targetType: proposal.targetType, targetSquadId, targetUserId, amount: dto.amount, reason: dto.reason.trim() },
      },
    });
    return proposal;
  }

  async listFineProposals(actor: AuthUser) {
    if (!([UserRole.CFO, UserRole.CPO, UserRole.CTO, UserRole.CEO] as string[]).includes(actor.role)) throw new ForbiddenException();
    return this.prisma.fineProposal.findMany({
      where: actor.role === UserRole.CFO || actor.role === UserRole.CEO ? {} : { proposedById: actor.id },
      orderBy: { createdAt: 'desc' }, take: 200,
      include: {
        targetSquad: { select: { id: true, name: true } },
        targetUser: { select: { id: true, fullName: true, role: true } },
        proposedBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
  }

  async approveFine(cfo: AuthUser, proposalId: string) {
    if (cfo.role !== UserRole.CFO) throw new ForbiddenException('Only the CFO may approve proposed fines');
    const result = await this.prisma.$transaction(async (tx) => {
      const proposal = await tx.fineProposal.findUnique({ where: { id: proposalId } });
      if (!proposal) throw new NotFoundException('Fine proposal not found');
      if (proposal.status !== 'PENDING') throw new AppException('CONFLICT', `Fine proposal is ${proposal.status}`);
      const target = proposal.targetType === FineTargetType.SQUAD
        ? await tx.account.findUnique({ where: { squadId: proposal.targetSquadId! } })
        : await tx.account.findUnique({ where: { ownerId: proposal.targetUserId! } });
      if (!target) throw new BadRequestException('Target wallet is not provisioned');
      const reserve = await this.ledger.systemReserve(tx);
      const claim = await tx.fineProposal.updateMany({ where: { id: proposalId, status: 'PENDING' }, data: { status: 'APPROVED', approvedById: cfo.id, approvedAt: new Date() } });
      if (!claim.count) throw new AppException('CONFLICT', 'Fine proposal was already processed');
      const transaction = await this.ledger.postTransaction({
        entries: [
          { accountId: target.id, direction: 'DEBIT', amount: Number(proposal.amount) },
          { accountId: reserve.id, direction: 'CREDIT', amount: Number(proposal.amount) },
        ],
        referenceType: 'FINE', referenceId: proposal.id,
        description: `CFO-approved fine: ${proposal.reason}`,
        idempotencyKey: `fine_proposal_${proposal.id}`, authorizedById: cfo.id,
      }, tx);
      await tx.fineProposal.update({ where: { id: proposal.id }, data: { ledgerTransactionId: transaction.id } });
      await tx.executiveAuditLog.create({
        data: {
          executiveId: cfo.id, executiveRole: UserRole.CFO, actionType: 'FINE_APPROVED', riskSeverity: 'WARNING',
          payloadSnapshot: { fineProposalId: proposal.id, targetType: proposal.targetType, targetSquadId: proposal.targetSquadId, targetUserId: proposal.targetUserId, amount: Number(proposal.amount), transactionId: transaction.id },
        },
      });
      return { transaction, targetId: target.id, reserveId: reserve.id, amount: Number(proposal.amount) };
    });
    await this.ledger.publishBalanceUpdates([result.targetId, result.reserveId]);
    return { success: true, proposalId, transactionId: result.transaction.id, amount: result.amount };
  }

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
        lineItems: { include: { user: { select: { id: true, fullName: true } } } },
      },
    });
  }

  /** API-CHRO-02: approve + atomic batch disbursement (idempotent replay per main.md §7.3). */
  async approveAndDisburse(approver: AuthUser, proposalId: string) {
    const approverId = approver.id;
    const replayKey = `payroll_${proposalId}`;

    // Authorize before idempotent replay as well as inside the transaction;
    // otherwise a PM could probe/replay another squad's completed payroll.
    const scopeProposal = await this.prisma.payrollProposal.findUnique({ where: { id: proposalId }, select: { squadId: true } });
    if (!scopeProposal) throw new NotFoundException('Proposal not found');
    if (approver.role !== UserRole.CPO && approver.role !== UserRole.CEO) {
      throw new ForbiddenException('Payroll disbursement requires CPO approval (CEO may override)');
    }

    // Idempotent replay: if this exact key already settled the ledger, return the original outcome
    const existingTx = await this.prisma.ledgerTransaction.findUnique({
      where: { idempotencyKey: replayKey },
      include: { entries: true },
    });
    if (existingTx && existingTx.referenceId === proposalId) {
      const proposal = await this.prisma.payrollProposal.findUnique({ where: { id: proposalId }, select: { status: true } });
      if (!proposal) throw new NotFoundException('Proposal not found');
      if (proposal.status === 'REJECTED') throw new AppException('CONFLICT', 'A rejected proposal has a settled payroll transaction');
      await this.prisma.payrollProposal.updateMany({
        where: { id: proposalId, status: 'SUBMITTED' },
        data: { status: 'APPROVED', approvedById: existingTx.authorizedById },
      });
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

    const result = await this.prisma.$transaction(async (tx) => {
      const proposal = await tx.payrollProposal.findUnique({
        where: { id: proposalId },
        include: { squad: { include: { account: true } }, lineItems: { include: { user: { include: { account: true } } } } },
      });
      if (!proposal) throw new NotFoundException('Proposal not found');
      if (!proposal.squad.account) throw new BadRequestException('Squad treasury account missing');
      if (approver.role !== UserRole.CPO && approver.role !== UserRole.CEO) {
        throw new ForbiddenException('Payroll disbursement requires CPO approval (CEO may override)');
      }

      const paidItems = proposal.lineItems.filter((i) => Number(i.amount) > 0);
      for (const item of paidItems) {
        const activeMember = await tx.squadMembership.findFirst({
          where: { userId: item.userId, squadId: proposal.squadId, leftAt: null }, select: { id: true },
        });
        if (!activeMember) throw new BadRequestException(`Payroll recipient ${item.userId} is no longer an active squad member`);
        if (!item.user.account) throw new BadRequestException(`User ${item.userId} has no personal wallet`);
      }

      const claimed = await tx.payrollProposal.updateMany({
        where: { id: proposalId, status: 'SUBMITTED' },
        data: { status: 'APPROVED', approvedById: approverId },
      });
      if (!claimed.count) throw new AppException('PAYROLL_ALREADY_APPROVED', `Proposal is ${proposal.status}`);

      const total = Number(proposal.totalProposed);
      const treasury = proposal.squad.account;
      const accountIds = [treasury.id, ...paidItems.map((item) => item.user.account!.id)];
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
        authorizedById: approverId,
      }, tx);

      await tx.executiveAuditLog.create({
        data: {
          executiveId: approverId,
          executiveRole: approver.role as UserRole,
          actionType: 'PAYROLL_DISBURSED',
          payloadSnapshot: {
            proposalId,
            squadId: proposal.squadId,
            squadName: proposal.squad.name,
            labNumber: proposal.labNumber,
            totalDisbursed: total,
            recipientsCount: paidItems.length,
          },
          riskSeverity: 'INFO',
        },
      });

      return { proposal, paidItems, total, accountIds };
    });

    await this.ledger.publishBalanceUpdates(result.accountIds);

    this.events.emitToRoom(this.events.squadRoom(result.proposal.squadId), 'payroll:executed', {
      proposalId: result.proposal.id,
      labNumber: result.proposal.labNumber,
      totalDisbursed: result.total,
    });

    return {
      proposalId: result.proposal.id,
      status: 'APPROVED',
      disbursedAmount: result.total,
      recipientsCount: result.paidItems.length,
      executedAt: new Date(),
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

  /** API-CHRO-04: slacker fine — BDT 2000 split CPO 500 / CFO 400 / reserve 1100 (BR-CHRO-16..19, BR-CFO-penalty). */
  async issueSlackerFine(cpoUserId: string, dto: { targetUserId: string; targetSquadId: string; reason: string }, idempotencyKey: string) {
    const fine = await this.settings.getNumber('SLACKER_FINE', 2000);
    const cpoCut = await this.settings.getNumber('CPO_SLACKER_CUT', 500);
    const cfoRate = await this.settings.getNumber('CFO_PENALTY_INCENTIVE', 0.20);
    const cfoUser = await this.prisma.user.findFirst({ where: { role: 'CFO', isActive: true } });
    const cfoCut = cfoUser ? Math.round(fine * cfoRate * 100) / 100 : 0;
    const reserveCut = Math.round((fine - cpoCut - cfoCut) * 100) / 100;

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
    if (cfoCut > 0 && cfoUser) {
      entries.push({ accountId: (await this.ledger.personalWallet(cfoUser.id)).id, direction: 'CREDIT', amount: cfoCut });
    }
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

    await this.prisma.executiveAuditLog.create({
      data: {
        executiveId: cpoUserId,
        executiveRole: 'CPO',
        actionType: 'ISSUE_SLACKER_FINE',
        payloadSnapshot: {
          targetUserId: dto.targetUserId,
          targetSquadId: dto.targetSquadId,
          fineAmount: fine,
          reason: dto.reason,
        },
        riskSeverity: 'WARNING',
      },
    }).catch(() => {});

    return {
      fineAmount: fine,
      cpoBounty: cpoCut,
      cfoCommission: cfoCut,
      reserveDeposit: reserveCut,
      chargedToWallet: fromWallet,
      chargedToSquadTreasury: fromSquad,
      issuedAt: new Date().toISOString(),
    };
  }
}
