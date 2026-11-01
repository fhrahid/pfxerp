import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';

/**
 * CFO Venture Equity (cfo.md §2.3):
 *  - buy 10% stakes (max 2 squads per sprint) from CFO wallet into squad treasury
 *  - automated 10% dividend on squad net revenue (used by sprint payouts & milestone releases)
 */
@Injectable()
export class EquityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
  ) {}

  async invest(cfoUserId: string, dto: { squadId: string; investedAmount: number; sprintNumber?: number }) {
    if (!(dto.investedAmount > 0)) throw new BadRequestException('Investment must be positive');
    const squad = await this.prisma.squad.findUnique({ where: { id: dto.squadId } });
    if (!squad) throw new NotFoundException('Squad not found');

    const sprintNumber = dto.sprintNumber ?? (await this.settings.currentSprint());
    const activeThisSprint = await this.prisma.equityStake.findMany({
      where: { investorId: cfoUserId, sprintNumber, isActive: true },
    });
    if (activeThisSprint.filter((s) => s.squadId === dto.squadId).length > 0) {
      throw new BadRequestException('Stake already held in this squad for the sprint');
    }
    if (new Set(activeThisSprint.map((s) => s.squadId)).size >= 2) {
      throw new BadRequestException('CFO may hold stakes in at most 2 squads per sprint (BR-CFO-13)');
    }

    const stakePercent = await this.settings.getNumber('EQUITY_STAKE_PERCENT', 0.10);
    const cfoWallet = await this.ledger.personalWallet(cfoUserId);
    const treasury = await this.ledger.squadTreasury(dto.squadId);

    const tx = await this.ledger.executeDoubleEntryTransfer({
      senderAccountId: cfoWallet.id,
      recipientAccountId: treasury.id,
      amount: dto.investedAmount,
      referenceType: 'EQUITY_INVESTMENT',
      description: `CFO venture investment — ${(stakePercent * 100).toFixed(0)}% equity in ${squad.name}`,
      idempotencyKey: `equity_${cfoUserId}_${dto.squadId}_${sprintNumber}`,
      authorizedById: cfoUserId,
    });

    return this.prisma.equityStake.create({
      data: {
        investorId: cfoUserId,
        squadId: dto.squadId,
        stakePercent,
        investedAmount: dto.investedAmount,
        sprintNumber,
        isActive: true,
      },
    });
  }

  async portfolio(cfoUserId: string) {
    const stakes = await this.prisma.equityStake.findMany({
      where: { investorId: cfoUserId },
      orderBy: { createdAt: 'desc' },
      include: { squad: { select: { id: true, name: true, valuation: true, healthStatus: true } } },
    });

    // Sum dividends received (EQUITY_DIVIDEND credits to the CFO wallet)
    const wallet = await this.prisma.account.findUnique({ where: { ownerId: cfoUserId } });
    let dividendsReceived = 0;
    if (wallet) {
      const agg = await this.prisma.ledgerEntry.aggregate({
        where: { accountId: wallet.id, direction: 'CREDIT', transaction: { referenceType: 'EQUITY_DIVIDEND' } },
        _sum: { amount: true },
      });
      dividendsReceived = Number(agg._sum.amount || 0);
    }

    return { stakes, dividendsReceived };
  }

  /** Active CFO stake on a squad, if any. */
  async activeStake(squadId: string) {
    return this.prisma.equityStake.findFirst({
      where: { squadId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * BR-CFO-15: automated dividend hook. Deducts the dividend rate of a squad's
   * net revenue from the treasury into the investor's wallet. Returns entries
   * for inclusion in a caller's composite transaction (avoids double-ledger hops).
   */
  async dividendEntriesForRevenue(squadId: string, netRevenue: number): Promise<{ entries: { accountId: string; direction: 'DEBIT' | 'CREDIT'; amount: number }[]; dividend: number; investorId: string } | null> {
    const stake = await this.activeStake(squadId);
    if (!stake) return null;
    const rate = await this.settings.getNumber('EQUITY_DIVIDEND_RATE', 0.10);
    const dividend = Math.round(netRevenue * rate * 100) / 100;
    if (dividend <= 0) return null;

    const treasury = await this.ledger.squadTreasury(squadId);
    const investorWallet = await this.ledger.personalWallet(stake.investorId);
    return {
      entries: [
        { accountId: treasury.id, direction: 'DEBIT', amount: dividend },
        { accountId: investorWallet.id, direction: 'CREDIT', amount: dividend },
      ],
      dividend,
      investorId: stake.investorId,
    };
  }

  /** Standalone dividend execution (used by milestone releases). */
  async payDividendOnRevenue(squadId: string, netRevenue: number, referenceId: string) {
    const plan = await this.dividendEntriesForRevenue(squadId, netRevenue);
    if (!plan) return null;
    const tx = await this.ledger.postTransaction({
      entries: plan.entries,
      referenceType: 'EQUITY_DIVIDEND',
      referenceId,
      description: `Automated equity dividend on BDT ${netRevenue.toFixed(2)} squad revenue`,
      idempotencyKey: `dividend_${referenceId}_${Date.now()}`,
      authorizedById: plan.investorId,
    });
    return { transactionId: tx.id, dividend: plan.dividend };
  }
}
