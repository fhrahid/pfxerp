import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';
import { EquityService } from '../equity/equity.service';
import { AuthUser } from '../../common/types';
import { AppException } from '../../common/exceptions/app.exception';

/**
 * Sprint Payout Engine (cfo.md §2.1):
 * CFO submits strict 1..N ranking -> CEO approves -> CFO executes the waterfall:
 *   SYSTEM_RESERVE -(gross)-> [5% CFO tax] + [95% squad net] (+10% PM bonus for top-3,
 *   +10% equity dividend where the CFO holds an active stake).
 */
@Injectable()
export class SprintPayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly equity: EquityService,
  ) {}

  async submit(cfoUserId: string, dto: { sprintNumber: number; rankings: { squadId: string; rank: number }[] }) {
    const ranks = dto.rankings.map((r) => r.rank).sort((a, b) => a - b);
    if (new Set(ranks).size !== ranks.length) {
      throw new BadRequestException('Duplicate ranks provided (BR-CFO-02)');
    }
    if (ranks.length === 0 || ranks[0] !== 1 || ranks.some((r, i) => r !== i + 1)) {
      throw new BadRequestException('Ranks must form a strict 1..N sequence (BR-CFO-02)');
    }

    const distribution = await this.settings.getJSON<number[]>('SPRINT_PAYOUT_DISTRIBUTION', [50000, 35000, 25000, 20000, 15000, 5000]);
    const squads = await this.prisma.squad.findMany({ where: { isActive: true } });
    const squadIds = new Set(squads.map((s) => s.id));
    if (dto.rankings.length !== squads.length) {
      throw new BadRequestException(`Squad count mismatch: ${dto.rankings.length} rankings vs ${squads.length} active squads`);
    }
    for (const r of dto.rankings) {
      if (!squadIds.has(r.squadId)) throw new BadRequestException(`Squad ${r.squadId} is not active`);
    }

    const existing = await this.prisma.sprintPayout.findUnique({ where: { sprintNumber: dto.sprintNumber } });
    if (existing) throw new AppException('CONFLICT', `Payout already exists for sprint ${dto.sprintNumber}`);

    const taxRate = await this.settings.getNumber('CFO_TAX_RATE', 0.05);
    const poolTotal = await this.settings.getNumber('SPRINT_POOL_TOTAL', 150000);

    const totalGross = dto.rankings.reduce((a, r) => a + (distribution[r.rank - 1] || 0), 0);

    const payout = await this.prisma.sprintPayout.create({
      data: {
        sprintNumber: dto.sprintNumber,
        totalPool: totalGross || poolTotal,
        status: 'PROPOSED',
        proposedById: cfoUserId,
        items: {
          create: dto.rankings.map((r) => {
            const gross = distribution[r.rank - 1] || 0;
            const tax = Math.round(gross * taxRate * 100) / 100;
            return {
              squadId: r.squadId,
              rank: r.rank,
              grossAmount: gross,
              taxAmount: tax,
              netAmount: gross - tax,
            };
          }),
        },
      },
      include: { items: true },
    });

    return payout;
  }

  async list() {
    return this.prisma.sprintPayout.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { squad: { select: { id: true, name: true } } } } },
    });
  }

  /** BR-CFO-06: CEO approval gate before any ledger movement. */
  async approveByCeo(ceoUserId: string, payoutId: string) {
    const payout = await this.prisma.sprintPayout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== 'PROPOSED') throw new AppException('CONFLICT', `Payout is ${payout.status}`);
    return this.prisma.sprintPayout.update({
      where: { id: payoutId },
      data: { status: 'APPROVED', approvedById: ceoUserId },
    });
  }

  /** Executes the full waterfall atomically per squad. */
  async execute(cfoUserId: string, payoutId: string, idempotencyKey: string) {
    const payout = await this.prisma.sprintPayout.findUnique({
      where: { id: payoutId },
      include: { items: true },
    });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status === 'EXECUTED') throw new AppException('CONFLICT', 'Payout already executed');
    if (payout.status !== 'APPROVED') {
      throw new ForbiddenException('CEO approval required before execution (BR-CFO-06)');
    }

    const taxRate = await this.settings.getNumber('CFO_TAX_RATE', 0.05);
    const bonusRate = await this.settings.getNumber('PM_LEADERSHIP_BONUS_RATE', 0.10);

    const reserve = await this.ledger.systemReserve();
    const cfoWallet = await this.ledger.personalWallet(cfoUserId);

    let cfoTaxCollected = 0;
    let pmBonuses = 0;

    for (const item of payout.items) {
      const treasury = await this.ledger.squadTreasury(item.squadId);
      const gross = Number(item.grossAmount);
      const tax = Math.round(gross * taxRate * 100) / 100;
      const net = gross - tax;
      cfoTaxCollected += tax;

      const entries: { accountId: string; direction: 'DEBIT' | 'CREDIT'; amount: number }[] = [
        { accountId: reserve.id, direction: 'DEBIT', amount: gross },
        { accountId: cfoWallet.id, direction: 'CREDIT', amount: tax },
        { accountId: treasury.id, direction: 'CREDIT', amount: net },
      ];

      // BR-CFO-15: automated equity dividend on net revenue
      const dividendPlan = await this.equity.dividendEntriesForRevenue(item.squadId, net);
      if (dividendPlan) entries.push(...dividendPlan.entries);

      // BR-CFO-05: top-3 PM leadership bonus (10% of net, deducted from squad)
      if (item.rank <= 3) {
        const pmId = await this.pmOfSquad(item.squadId);
        if (pmId) {
          const bonus = Math.round(net * bonusRate * 100) / 100;
          const pmWallet = await this.ledger.personalWallet(pmId);
          entries.push({ accountId: treasury.id, direction: 'DEBIT', amount: bonus });
          entries.push({ accountId: pmWallet.id, direction: 'CREDIT', amount: bonus });
          pmBonuses += bonus;
          await this.prisma.sprintPayoutItem.update({
            where: { payoutId_squadId: { payoutId, squadId: item.squadId } },
            data: { pmBonusAmount: bonus },
          });
        }
      }

      await this.ledger.postTransaction({
        entries,
        referenceType: 'SPRINT_PAYOUT',
        referenceId: payout.id,
        description: `Sprint ${payout.sprintNumber} payout — rank ${item.rank} (gross ${gross.toFixed(2)})`,
        idempotencyKey: `${idempotencyKey || `payout_${payout.id}`}_item_${item.squadId}`,
        authorizedById: cfoUserId,
      });
    }

    const updated = await this.prisma.sprintPayout.update({
      where: { id: payoutId },
      data: { status: 'EXECUTED', executedAt: new Date() },
    });

    return {
      sprintNumber: updated.sprintNumber,
      totalPoolDisbursed: payout.items.reduce((a, i) => a + Number(i.grossAmount), 0),
      cfoTaxCollected: Math.round(cfoTaxCollected * 100) / 100,
      pmBonusesDisbursed: Math.round(pmBonuses * 100) / 100,
      executedAt: updated.executedAt,
    };
  }

  private async pmOfSquad(squadId: string): Promise<string | null> {
    const m = await this.prisma.squadMembership.findFirst({
      where: { squadId, role: 'PM', leftAt: null },
    });
    return m?.userId ?? null;
  }
}
