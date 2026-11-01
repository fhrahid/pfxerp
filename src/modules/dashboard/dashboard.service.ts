import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

/**
 * Aggregated dashboards (ceo.md §2, other.md §4) + the Simulation Stock Exchange
 * leaderboard with dynamic valuation and health write-backs.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** Recognized client revenue credited to a squad treasury (ESCROW_RELEASE credits). */
  private async recognizedRevenue(squadTreasuryId: string): Promise<number> {
    const agg = await this.prisma.ledgerEntry.aggregate({
      where: {
        accountId: squadTreasuryId,
        direction: 'CREDIT',
        transaction: { referenceType: 'ESCROW_RELEASE' },
      },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount || 0);
  }

  private async activeDebt(squadId: string): Promise<number> {
    const agg = await this.prisma.loan.aggregate({
      where: { borrowerSquadId: squadId, status: 'ACTIVE', repaidAt: null, disbursedAt: { not: null } },
      _sum: { totalDue: true },
    });
    return Number(agg._sum.totalDue || 0);
  }

  /** Valuation = treasury + 1.5 x recognized revenue - active debt (other.md §4.1). */
  private async computeValuation(squadId: string, treasuryBalance: number, treasuryAccountId: string) {
    const revenue = await this.recognizedRevenue(treasuryAccountId);
    const debt = await this.activeDebt(squadId);
    return treasuryBalance + revenue * 1.5 - debt;
  }

  private healthFor(runway: number): 'BULLISH' | 'STABLE' | 'BANKRUPT_RISK' {
    if (runway > 6) return 'BULLISH';
    if (runway >= 2) return 'STABLE';
    return 'BANKRUPT_RISK';
  }

  /** Recomputes + persists valuations & health for every squad. */
  async refreshSquadMetrics() {
    const burn = await this.settings.getNumber('WEEKLY_LAB_BUDGET', 10000);
    const squads = await this.prisma.squad.findMany({
      where: { isActive: true },
      include: { account: true, borrowedLoans: { where: { status: 'ACTIVE', repaidAt: null } } },
    });

    const results = [];
    for (const squad of squads) {
      const balance = squad.account ? Number(squad.account.balance) : 0;
      const valuation = await this.computeValuation(squad.id, balance, squad.account?.id ?? '');
      const runway = burn > 0 ? balance / burn : 0;
      const health = this.healthFor(runway);

      await this.prisma.squad.update({
        where: { id: squad.id },
        data: { valuation: new Prisma.Decimal(valuation.toFixed(2)), healthStatus: health },
      });

      results.push({
        id: squad.id,
        name: squad.name,
        balance,
        valuation,
        runwayPeriods: Math.round(runway * 10) / 10,
        health,
        activeDebt: squad.borrowedLoans.reduce((a, l) => a + Number(l.totalDue), 0),
      });
    }
    return results;
  }

  /** API-CEO-01: 360 command center. */
  async ceoDashboard() {
    const squads = await this.refreshSquadMetrics();

    const [accounts, contracts, pendingDecisions, chaosIncidents, executives] = await Promise.all([
      this.prisma.account.findMany(),
      this.prisma.clientContract.count({ where: { status: 'ACTIVE' } }),
      this.prisma.boardDecision.count({ where: { status: { in: ['PROPOSED', 'APPROVED'] } } }),
      this.prisma.chaosEvent.count({ where: { resolvedAt: null } }),
      this.prisma.user.findMany({
        where: { role: { in: ['CFO', 'CTO', 'CPO'] } },
        include: { account: true },
      }),
    ]);

    const escrow = accounts.find((a) => a.type === 'ESCROW');
    const circulating = accounts
      .filter((a) => a.type === 'SQUAD_TREASURY' || a.type === 'PERSONAL_WALLET')
      .reduce((sum, a) => sum + Number(a.balance), 0);

    // DPI / PMHI squad averages
    const dpiAgg = await this.prisma.developerPerformanceSnapshot.groupBy({
      by: ['userId'],
      _avg: { dpiScore: true },
    });
    const pmhiAgg = await this.prisma.pmPerformanceSnapshot.groupBy({
      by: ['userId'],
      _avg: { pmhiScore: true },
    });
    const memberships = await this.prisma.squadMembership.findMany({
      where: { leftAt: null },
      select: { squadId: true, userId: true },
    });
    const dpiByUser = new Map(dpiAgg.map((d) => [d.userId, Number(d._avg.dpiScore || 0)]));
    const pmhiByUser = new Map(pmhiAgg.map((d) => [d.userId, Number(d._avg.pmhiScore || 0)]));

    const squadsWithMembers = squads.map((s) => {
      const members = memberships.filter((m) => m.squadId === s.id);
      const dpis = members.map((m) => dpiByUser.get(m.userId)).filter((v): v is number => v != null);
      const pmhis = members.map((m) => pmhiByUser.get(m.userId)).filter((v): v is number => v != null);
      return {
        ...s,
        dpiAvg: dpis.length ? Math.round((dpis.reduce((a, b) => a + b, 0) / dpis.length) * 10) / 10 : null,
        pmhi: pmhis.length ? Math.round(Math.max(...pmhis) * 10) / 10 : null,
      };
    });

    const recentTransactions = await this.prisma.ledgerTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { entries: { include: { account: true } }, authorizedBy: { select: { fullName: true, role: true } } },
    });

    return {
      macro: {
        circulatingCash: Math.round(circulating * 100) / 100,
        activeEscrow: escrow ? Number(escrow.balance) : 0,
        avgRunwayPeriods:
          Math.round((squads.reduce((a, s) => a + s.runwayPeriods, 0) / Math.max(squads.length, 1)) * 10) / 10,
        activeClientContracts: contracts,
        studioValuation: Math.round(squads.reduce((a, s) => a + s.valuation, 0) * 100) / 100,
      },
      squads: squadsWithMembers,
      executives: executives.map((e) => ({
        role: e.role,
        name: e.fullName,
        walletBalance: e.account ? Number(e.account.balance) : 0,
      })),
      pendingDecisionsCount: pendingDecisions,
      activeChaosIncidents: chaosIncidents,
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        type: t.referenceType,
        description: t.description,
        amount: t.entries.filter((e) => e.direction === 'DEBIT').reduce((a, e) => a + Number(e.amount), 0),
        by: t.authorizedBy.fullName,
        at: t.createdAt,
      })),
    };
  }

  async ctoDashboard() {
    const [pendingTasks, pendingCerts, citationsAgg, bountyAgg] = await Promise.all([
      this.prisma.task.count({ where: { status: 'PM_VERIFIED' } }),
      this.prisma.ctoProviderCertification.count({ where: { reviewedById: null, qualityScore: null } }),
      this.prisma.codeAuditCitation.aggregate({ _sum: { fineAmount: true }, _count: true }),
      this.prisma.bugReport.aggregate({ where: { status: 'SUBMITTED' }, _count: true }),
    ]);
    return {
      pendingTaskVerifications: pendingTasks,
      pendingCertificationReviews: pendingCerts,
      totalAuditFinesLevied: Number(citationsAgg._sum.fineAmount || 0),
      activeCitations: citationsAgg._count,
      bugReportsAwaitingTriage: bountyAgg._count,
    };
  }

  async cfoDashboard() {
    const squads = await this.refreshSquadMetrics();
    const loans = await this.prisma.loan.findMany({
      orderBy: { createdAt: 'desc' },
      include: { borrowerSquad: { select: { name: true } } },
    });
    const cfo = await this.prisma.user.findFirst({ where: { role: 'CFO' }, include: { account: true } });
    const stakes = await this.prisma.equityStake.findMany({
      where: { isActive: true },
      include: { squad: { select: { name: true, valuation: true } } },
    });
    return {
      squadRunwayMatrix: squads,
      loanBook: loans.map((l) => ({
        id: l.id,
        squad: l.borrowerSquad.name,
        principal: Number(l.principalAmount),
        totalDue: Number(l.totalDue),
        status: l.status,
        dueDate: l.dueDate,
      })),
      equityPortfolio: stakes,
      cfoWalletBalance: cfo?.account ? Number(cfo.account.balance) : 0,
    };
  }

  async meDashboard(user: { id: string; role: string; squadIds: string[] }) {
    const wallet = await this.prisma.account.findUnique({ where: { ownerId: user.id } });
    const myTasks = await this.prisma.task.count({ where: { assignedToId: user.id, status: { in: ['TODO', 'IN_PROGRESS', 'FLAGGED_COMPLETE'] } } });
    const snapshot = await this.prisma.developerPerformanceSnapshot.findFirst({
      where: { userId: user.id },
      orderBy: { sprintNumber: 'desc' },
    });
    const squads = await this.prisma.squad.findMany({
      where: user.squadIds.length ? { id: { in: user.squadIds } } : { id: 'none' },
      include: { account: true },
    });
    return {
      walletBalance: wallet ? Number(wallet.balance) : 0,
      openTasks: myTasks,
      latestDpi: snapshot ? Number(snapshot.dpiScore) : null,
      squads: squads.map((s) => ({ id: s.id, name: s.name, balance: s.account ? Number(s.account.balance) : 0, health: s.healthStatus })),
    };
  }

  /** API-OTH-02: simulation leaderboard + student scores (other.md §4.2). */
  async leaderboard() {
    const squads = await this.refreshSquadMetrics();
    const students = await this.prisma.user.findMany({
      where: { role: { in: ['DEVELOPER', 'PM'] }, isActive: true },
      include: { account: true, squadMemberships: { where: { leftAt: null }, select: { squadId: true, isPrimary: true } } },
    });

    const maxValuation = Math.max(...squads.map((s) => s.valuation), 1);
    const wallets = students.map((s) => (s.account ? Number(s.account.balance) : 0));
    const maxWallet = Math.max(...wallets, 1);

    const squadLeaderboard = [...squads]
      .sort((a, b) => b.valuation - a.valuation)
      .map((s, i) => ({ rank: i + 1, squadId: s.id, squadName: s.name, valuation: s.valuation, healthStatus: s.health }));

    const valuationBySquad = new Map(squads.map((s) => [s.id, s.valuation]));

    const studentScores = students
      .map((student, idx) => {
        const squadId = student.squadMemberships.find((m) => m.isPrimary)?.squadId ?? student.squadMemberships[0]?.squadId;
        const valuation = squadId ? valuationBySquad.get(squadId) ?? 0 : 0;
        const wallet = wallets[idx];
        const normalizedValuation = (valuation / maxValuation) * 100;
        const normalizedWallet = (wallet / maxWallet) * 100;
        const simulationScore = Math.round((0.5 * normalizedValuation + 0.5 * normalizedWallet) * 10) / 10;
        return {
          userId: student.id,
          fullName: student.fullName,
          role: student.role,
          squadId,
          walletBalance: wallet,
          squadValuation: valuation,
          simulationScore,
        };
      })
      .sort((a, b) => b.simulationScore - a.simulationScore);

    return { squadLeaderboard, studentScores };
  }
}
