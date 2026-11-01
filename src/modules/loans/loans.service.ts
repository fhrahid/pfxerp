import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';
import { AuthUser, isExecRole, isBoardRole, isOverrideRole } from '../../common/types';
import { AppException } from '../../common/exceptions/app.exception';

/**
 * Emergency Lending Facility (cfo.md §2.2):
 * apply (PM, squad balance < threshold) -> 2-of-3 board vote + CEO sign-off (governance module)
 * -> CFO disburses -> PM repays principal to reserve + 15% interest to CFO.
 */
@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
  ) {}

  async apply(user: AuthUser, dto: { squadId: string; principalAmount: number }) {
    const membership = await this.prisma.squadMembership.findFirst({
      where: { userId: user.id, squadId: dto.squadId, role: 'PM', leftAt: null },
    });
    if (!membership && user.role !== UserRole.CEO) {
      throw new ForbiddenException('Only the squad PM may apply for an emergency loan');
    }

    if (!(dto.principalAmount > 0)) throw new BadRequestException('Principal must be positive');

    const existing = await this.prisma.loan.findFirst({
      where: { borrowerSquadId: dto.squadId, status: 'ACTIVE', repaidAt: null },
    });
    if (existing) throw new AppException('LOAN_ALREADY_ACTIVE');

    const treasury = await this.ledger.squadTreasury(dto.squadId);
    const threshold = await this.settings.getNumber('LOAN_THRESHOLD_BALANCE', 15000);
    if (Number(treasury.balance) >= threshold) {
      throw new BadRequestException(
        `Squad treasury (BDT ${Number(treasury.balance).toFixed(2)}) is above the BDT ${threshold} emergency threshold (BR-CFO-07)`,
      );
    }

    const rate = await this.settings.getNumber('LOAN_INTEREST_RATE', 0.15);
    const interest = Math.round(dto.principalAmount * rate * 100) / 100;

    return this.prisma.loan.create({
      data: {
        borrowerSquadId: dto.squadId,
        principalAmount: dto.principalAmount,
        interestRate: rate,
        interestAmount: interest,
        totalDue: dto.principalAmount + interest,
        status: 'ACTIVE',
      },
    });
  }

  async list(user: AuthUser) {
    const isExec = isExecRole(user.role);
    const loans = await this.prisma.loan.findMany({
      where: isExec ? {} : { borrowerSquadId: { in: user.squadIds.length ? user.squadIds : ['none'] } },
      orderBy: { createdAt: 'desc' },
      include: { borrowerSquad: { select: { id: true, name: true } } },
    });

    // Lazy default evaluation: overdue active disbursed loans flip to DEFAULTED (BR-CFO-11)
    const now = Date.now();
    for (const loan of loans) {
      if (loan.status === 'ACTIVE' && loan.disbursedAt && loan.dueDate && loan.dueDate.getTime() < now && !loan.repaidAt) {
        await this.prisma.loan.update({ where: { id: loan.id }, data: { status: 'DEFAULTED' } });
        await this.prisma.squad.update({ where: { id: loan.borrowerSquadId }, data: { healthStatus: 'BANKRUPT_RISK' } });
        loan.status = 'DEFAULTED';
      }
    }
    return loans;
  }

  /** CFO executes the disbursement after board + CEO approval (BR-CFO-08, BR-CFO-06). */
  async disburse(cfoUserId: string, loanId: string, idempotencyKey: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { borrowerSquad: true },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.disbursedAt) throw new BadRequestException('Loan already disbursed');

    const decision = await this.prisma.boardDecision.findFirst({
      where: { category: 'LOAN_APPROVAL', referenceId: loan.id, status: 'CEO_APPROVED' },
    });
    if (!loan.ceoApproved && !decision) {
      throw new AppException('LOAN_GOVERNANCE_REQUIRED', 'Loan requires a 2-of-3 board decision with CEO sign-off before disbursement');
    }

    const reserve = await this.ledger.systemReserve();
    const treasury = await this.ledger.squadTreasury(loan.borrowerSquadId);

    await this.ledger.executeDoubleEntryTransfer({
      senderAccountId: reserve.id,
      recipientAccountId: treasury.id,
      amount: Number(loan.principalAmount),
      referenceType: 'LOAN_DISBURSEMENT',
      referenceId: loan.id,
      description: `Emergency loan disbursement for ${loan.borrowerSquad.name}`,
      idempotencyKey: idempotencyKey || `loan_disburse_${loan.id}`,
      authorizedById: cfoUserId,
    });

    return this.prisma.loan.update({
      where: { id: loanId },
      data: {
        disbursedAt: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // due next sprint
        approvedById: cfoUserId,
      },
    });
  }

  /** PM repays: principal -> SYSTEM_RESERVE, interest -> CFO wallet (BR-CFO-10). */
  async repay(user: AuthUser, loanId: string, idempotencyKey: string) {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== 'ACTIVE' || !loan.disbursedAt || loan.repaidAt) {
      throw new BadRequestException('Loan is not in a repayable state');
    }

    const membership = await this.prisma.squadMembership.findFirst({
      where: { userId: user.id, squadId: loan.borrowerSquadId, role: 'PM', leftAt: null },
    });
    if (!membership && user.role !== UserRole.CEO) {
      throw new ForbiddenException('Only the squad PM may repay the loan');
    }

    const treasury = await this.ledger.squadTreasury(loan.borrowerSquadId);
    const balance = Number(treasury.balance);
    const totalDue = Number(loan.totalDue);
    if (balance < totalDue) {
      throw new AppException(
        'LEDGER_INSUFFICIENT_FUNDS',
        `Treasury balance BDT ${balance.toFixed(2)} cannot cover total due BDT ${totalDue.toFixed(2)}; squad defaults`,
        { availableBalance: balance, requestedAmount: totalDue },
      );
    }

    const reserve = await this.ledger.systemReserve();
    const cfo = await this.prisma.user.findFirst({ where: { role: 'CFO' } });
    if (!cfo) throw new BadRequestException('CFO account not provisioned');
    const cfoWallet = await this.ledger.personalWallet(cfo.id);

    await this.ledger.postTransaction({
      entries: [
        { accountId: treasury.id, direction: 'DEBIT', amount: totalDue },
        { accountId: reserve.id, direction: 'CREDIT', amount: Number(loan.principalAmount) },
        { accountId: cfoWallet.id, direction: 'CREDIT', amount: Number(loan.interestAmount) },
      ],
      referenceType: 'LOAN_REPAYMENT',
      referenceId: loan.id,
      description: `Loan repayment: principal to reserve, interest to CFO`,
      idempotencyKey: idempotencyKey || `loan_repay_${loan.id}`,
      authorizedById: user.id,
    });

    return this.prisma.loan.update({
      where: { id: loanId },
      data: { status: 'REPAID', repaidAt: new Date() },
    });
  }
}
