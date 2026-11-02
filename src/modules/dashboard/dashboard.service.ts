import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EventsGateway } from '../../events/events.gateway';
import { Cron } from '@nestjs/schedule';

/**
 * Aggregated dashboards (ceo.md §2, other.md §4) + the Simulation Stock Exchange
 * leaderboard with dynamic valuation and health write-backs.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly events: EventsGateway,
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

  /** Squad MAU & API volume across products over the trailing 30 days (other.md §4.1). */
  private async squadUsageMetrics(squadId: string): Promise<{ mau: number; apiInvocations: number }> {
    const products = await this.prisma.product.findMany({ where: { squadId }, select: { id: true } });
    if (!products.length) return { mau: 0, apiInvocations: 0 };
    const productIds = products.map((p) => p.id);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const agg = await this.prisma.productTelemetryHourly.aggregate({
      where: { productId: { in: productIds }, recordedHour: { gte: thirtyDaysAgo } },
      _sum: { activeUsers: true, apiRequests: true },
    });
    return {
      mau: Number(agg._sum.activeUsers || 0),
      apiInvocations: Number(agg._sum.apiRequests || 0),
    };
  }

  /** Valuation = treasury + 1.5 x recognized revenue + (MAU x beta) + (API x alpha) - active debt (other.md §4.1). */
  private async computeValuation(squadId: string, treasuryBalance: number, treasuryAccountId: string) {
    const revenue = await this.recognizedRevenue(treasuryAccountId);
    const debt = await this.activeDebt(squadId);
    const usage = await this.squadUsageMetrics(squadId);
    const beta = await this.settings.getNumber('VALUATION_MAU_BETA', 100);
    const alpha = await this.settings.getNumber('VALUATION_API_ALPHA', 0.05);
    const usageLift = (usage.mau * beta) + (usage.apiInvocations * alpha);
    return treasuryBalance + revenue * 1.5 + usageLift - debt;
  }

  private healthFor(runway: number): 'BULLISH' | 'STABLE' | 'BANKRUPT_RISK' {
    if (runway > 6) return 'BULLISH';
    if (runway >= 2) return 'STABLE';
    return 'BANKRUPT_RISK';
  }

  /** Recomputes + persists valuations & health for every squad. */
  @Cron('0 0 * * *', { timeZone: 'UTC' })
  async refreshSquadMetrics() {
    const defaultBurn = await this.settings.getNumber('WEEKLY_LAB_BUDGET', 10000);
    const sprintNumber = await this.settings.currentSprint();
    const squads = await this.prisma.squad.findMany({
      where: { isActive: true },
      include: { account: true, borrowedLoans: { where: { status: 'ACTIVE', repaidAt: null } } },
    });

    return Promise.all(
      squads.map(async (squad) => {
        const balance = squad.account ? Number(squad.account.balance) : 0;
        const valuation = await this.computeValuation(squad.id, balance, squad.account?.id ?? '');
        const [recentPayrolls, pendingMilestones] = await Promise.all([
          this.prisma.payrollProposal.findMany({
            where: { squadId: squad.id, status: 'APPROVED' },
            orderBy: { labNumber: 'desc' },
            take: 4,
            select: { totalProposed: true },
          }),
          this.prisma.clientMilestone.findMany({
            where: { assignedSquadId: squad.id, status: { not: 'PAID' }, contract: { status: 'ACTIVE' } },
            select: { contractId: true, payoutAmount: true, contract: { select: { escrowBalance: true } } },
          }),
        ]);
        const burn = recentPayrolls.length
          ? recentPayrolls.reduce((sum, item) => sum + Number(item.totalProposed), 0) / recentPayrolls.length
          : defaultBurn;
        const pendingByContract = new Map<string, { pending: number; escrow: number }>();
        for (const milestone of pendingMilestones) {
          const current = pendingByContract.get(milestone.contractId) || {
            pending: 0,
            escrow: Number(milestone.contract.escrowBalance),
          };
          current.pending += Number(milestone.payoutAmount);
          pendingByContract.set(milestone.contractId, current);
        }
        const pendingEscrow = [...pendingByContract.values()]
          .reduce((sum, contract) => sum + Math.min(contract.pending, contract.escrow), 0);
        const runway = burn > 0 ? (balance + pendingEscrow) / burn : 0;
        const health = this.healthFor(runway);

        if (health === 'BANKRUPT_RISK' && squad.healthStatus !== 'BANKRUPT_RISK') {
          this.events.emitToStudio('health:alert', {
            squadId: squad.id,
            metric: 'runway',
            status: 'BANKRUPT_RISK',
            currentRunway: Math.round(runway * 10) / 10,
          });
        }

        if (Number(squad.valuation) !== Math.round(valuation * 100) / 100 || squad.healthStatus !== health) {
          await this.prisma.squad.update({
            where: { id: squad.id },
            data: { valuation: new Prisma.Decimal(valuation.toFixed(2)), healthStatus: health },
          });
        }

        await this.prisma.squadHealthSnapshot.upsert({
          where: { squadId_sprintNumber: { squadId: squad.id, sprintNumber } },
          create: {
            squadId: squad.id,
            sprintNumber,
            bankBalance: balance,
            burnRate: burn,
            runwayPeriods: runway,
            healthStatus: health,
            valuation,
          },
          update: {
            bankBalance: balance,
            burnRate: burn,
            runwayPeriods: runway,
            healthStatus: health,
            valuation,
            calculatedAt: new Date(),
          },
        });

        return {
          id: squad.id,
          name: squad.name,
          balance,
          valuation,
          runwayPeriods: Math.round(runway * 10) / 10,
          health,
          activeDebt: squad.borrowedLoans.reduce((a, l) => a + Number(l.totalDue), 0),
        };
      }),
    );
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

    // Executive action logging and collusion detection (BR-CEO-11)
    const [recentExecutiveAuditLogs, ctoCitations, auditCountsByExecutive] = await Promise.all([
      this.prisma.executiveAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
          executive: { select: { id: true, fullName: true, role: true } },
        },
      }),
      this.prisma.codeAuditCitation.findMany({
        select: { squadId: true, squad: { select: { name: true } } },
      }),
      this.prisma.executiveAuditLog.groupBy({
        by: ['executiveId'],
        _count: { id: true },
      }),
    ]);

    const auditCountMap = new Map(auditCountsByExecutive.map((a) => [a.executiveId, a._count.id]));
    const execBalances = executives.map((e) => Number(e.account?.balance || 0));
    const totalExecBalance = execBalances.reduce((a, b) => a + b, 0);
    const peerAvgBalance = executives.length ? totalExecBalance / executives.length : 0;

    const citationsBySquad: Record<string, { name: string; count: number }> = {};
    for (const c of ctoCitations) {
      if (!citationsBySquad[c.squadId]) {
        citationsBySquad[c.squadId] = { name: c.squad?.name || c.squadId, count: 0 };
      }
      citationsBySquad[c.squadId].count++;
    }
    const totalCitations = ctoCitations.length;

    const enrichedExecutives = executives.map((e) => {
      const bal = e.account ? Number(e.account.balance) : 0;
      const anomalies: string[] = [];

      if (peerAvgBalance > 0 && bal > peerAvgBalance * 1.5) {
        anomalies.push('HIGH_WALLET_VELOCITY');
      }

      if (e.role === 'CTO' && totalCitations >= 3) {
        for (const [, item] of Object.entries(citationsBySquad)) {
          if (item.count / totalCitations > 0.6) {
            anomalies.push(`CITATION_BIAS (${item.name}: ${Math.round((item.count / totalCitations) * 100)}%)`);
          }
        }
      }

      return {
        id: e.id,
        role: e.role,
        name: e.fullName,
        walletBalance: bal,
        actionCount: auditCountMap.get(e.id) || 0,
        anomalyFlags: anomalies,
      };
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
      executives: enrichedExecutives,
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
      recentExecutiveActions: recentExecutiveAuditLogs.map((log) => ({
        id: log.id,
        executiveName: log.executive?.fullName || 'Unknown',
        executiveRole: log.executiveRole,
        actionType: log.actionType,
        riskSeverity: log.riskSeverity,
        payload: log.payloadSnapshot,
        createdAt: log.createdAt,
      })),
    };
  }

  async squadTechScores() {
    const squads = await this.prisma.squad.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    const results = await Promise.all(squads.map((s) => this.computeSquadTechScore(s.id, s.name)));
    return results.sort((a, b) => b.score - a.score);
  }

  async computeSquadTechScore(squadId: string, squadName?: string) {
    if (!squadName) {
      const s = await this.prisma.squad.findUnique({ where: { id: squadId } });
      squadName = s?.name || squadId;
    }

    const [citationsCount, criticalBugs, majorBugs, minorBugs, verifiedTasks, rejectedTasks] = await Promise.all([
      this.prisma.codeAuditCitation.count({ where: { squadId } }),
      this.prisma.bugReport.count({ where: { targetSquadId: squadId, status: 'CTO_VERIFIED', severity: 'CRITICAL' } }),
      this.prisma.bugReport.count({ where: { targetSquadId: squadId, status: 'CTO_VERIFIED', severity: 'MAJOR' } }),
      this.prisma.bugReport.count({ where: { targetSquadId: squadId, status: 'CTO_VERIFIED', severity: 'MINOR' } }),
      this.prisma.task.count({ where: { squadId, status: { in: ['CTO_VERIFIED', 'CLOSED'] } } }),
      this.prisma.task.count({ where: { squadId, ctoQualityPassed: false } }),
    ]);

    const totalAudited = verifiedTasks + rejectedTasks;
    const passRate = totalAudited > 0 ? verifiedTasks / totalAudited : 1.0;

    let score = 100 - citationsCount * 10 - criticalBugs * 15 - majorBugs * 8 - minorBugs * 3;
    if (totalAudited > 0) {
      score += Math.round(passRate * 20) - 10;
    }
    score = Math.max(0, Math.min(100, Math.round(score)));

    let tier: 'Tier S' | 'Tier A' | 'Tier B' | 'Tier C' | 'Tier F';
    let multiplier: number;
    let consequences: string;

    if (score >= 90) {
      tier = 'Tier S';
      multiplier = 1.25;
      consequences = 'Priority marketplace listing display; +15% squad seed funding bonus';
    } else if (score >= 75) {
      tier = 'Tier A';
      multiplier = 1.0;
      consequences = 'Standard operational clearance; full consultancy access';
    } else if (score >= 60) {
      tier = 'Tier B';
      multiplier = 0.85;
      consequences = 'Mandatory CTO architectural audit on all PRs; -10% equity grant cut';
    } else if (score >= 40) {
      tier = 'Tier C';
      multiplier = 0.6;
      consequences = 'Squad treasury blocked from dividend payouts; weekly audit fines doubled';
    } else {
      tier = 'Tier F';
      multiplier = 0.25;
      consequences = 'Squad feature freeze; marketplace purchases and consultancy bookings frozen';
    }

    return {
      squadId,
      squadName,
      score,
      tier,
      multiplier,
      consequences,
      citationsCount,
      criticalBugs,
      majorBugs,
      taskPassRate: Math.round(passRate * 100) / 100,
    };
  }

  async ctoDashboard() {
    const [pendingTasks, pendingCerts, citationsAgg, bountyAgg, techScores] = await Promise.all([
      this.prisma.task.count({ where: { status: 'PM_VERIFIED' } }),
      this.prisma.ctoProviderCertification.count({ where: { reviewedById: null, qualityScore: null } }),
      this.prisma.codeAuditCitation.aggregate({ _sum: { fineAmount: true }, _count: true }),
      this.prisma.bugReport.aggregate({ where: { status: 'SUBMITTED' }, _count: true }),
      this.squadTechScores(),
    ]);
    return {
      pendingTaskVerifications: pendingTasks,
      pendingCertificationReviews: pendingCerts,
      totalAuditFinesLevied: Number(citationsAgg._sum.fineAmount || 0),
      activeCitations: citationsAgg._count,
      bugReportsAwaitingTriage: bountyAgg._count,
      techScores,
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
