import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContractStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { EquityService } from '../equity/equity.service';
import { EventsGateway } from '../../events/events.gateway';
import { AuthUser } from '../../common/types';
import { AppException } from '../../common/exceptions/app.exception';

/**
 * Real-Client Pipeline (other.md §2):
 * DRAFT -> SIGNED -> ACTIVE -> milestones (PENDING -> IN_PROGRESS -> CTO_AUDIT -> CLIENT_REVIEW -> PAID)
 * Escrow waterfall on acceptance: 25% reserve / 65% squad / 10% executive overhead (+ CFO dividend).
 */
@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly equity: EquityService,
    private readonly events: EventsGateway,
  ) {}

  async createClient(dto: { companyName: string; contactName?: string; contactEmail: string }) {
    return this.prisma.client.create({ data: dto });
  }

  async listClients() {
    return this.prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: { contracts: { include: { _count: { select: { milestones: true } } } } },
    });
  }

  async createContract(dto: {
    clientId: string;
    title: string;
    contractType: 'TIME_AND_MATERIALS' | 'FIXED_BID' | 'RETAINER';
    totalValue: number;
    studioReservePercent?: number;
    squadSharePercent?: number;
    execOverheadPercent?: number;
  }) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Client not found');

    const studio = dto.studioReservePercent ?? 0.25;
    const squad = dto.squadSharePercent ?? 0.65;
    const exec = dto.execOverheadPercent ?? 0.10;
    if (Math.abs(studio + squad + exec - 1.0) > 0.001) {
      throw new BadRequestException('Revenue splits must sum to 1.00 (BR-OTH-03)');
    }

    return this.prisma.clientContract.create({
      data: {
        clientId: dto.clientId,
        title: dto.title,
        contractType: dto.contractType,
        totalValue: dto.totalValue,
        studioReservePercent: studio,
        squadSharePercent: squad,
        execOverheadPercent: exec,
        status: 'SIGNED',
      },
    });
  }

  async listContracts() {
    return this.prisma.clientContract.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, companyName: true, contactEmail: true } },
        milestones: { include: { assignedSquad: { select: { id: true, name: true } } } },
      },
    });
  }

  async addMilestone(dto: { contractId: string; milestoneName: string; payoutAmount: number; dueDate?: string }) {
    const contract = await this.prisma.clientContract.findUnique({ where: { id: dto.contractId } });
    if (!contract) throw new NotFoundException('Contract not found');
    return this.prisma.clientMilestone.create({
      data: {
        contractId: dto.contractId,
        milestoneName: dto.milestoneName,
        payoutAmount: dto.payoutAmount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
  }

  /** Client escrow deposit: SYSTEM_RESERVE (external funds proxy) -> ESCROW. */
  async fundEscrow(user: AuthUser, milestoneId: string, amount: number, idempotencyKey: string) {
    const milestone = await this.prisma.clientMilestone.findUnique({ where: { id: milestoneId }, include: { contract: true } });
    if (!milestone) throw new NotFoundException('Milestone not found');

    const reserve = await this.ledger.systemReserve();
    const escrow = await this.ledger.escrow();

    await this.ledger.executeDoubleEntryTransfer({
      senderAccountId: reserve.id,
      recipientAccountId: escrow.id,
      amount,
      referenceType: 'ESCROW_DEPOSIT',
      referenceId: milestone.id,
      description: `Client escrow deposit for milestone '${milestone.milestoneName}'`,
      idempotencyKey: idempotencyKey || `escrow_${milestone.id}_${Date.now()}`,
      authorizedById: user.id,
    });

    await this.prisma.clientContract.update({
      where: { id: milestone.contractId },
      data: { escrowBalance: { increment: amount }, status: 'ACTIVE' },
    });

    return this.prisma.clientMilestone.update({
      where: { id: milestoneId },
      data: { status: 'IN_PROGRESS' },
    });
  }

  async assignSquad(user: AuthUser, milestoneId: string, squadId: string) {
    const milestone = await this.prisma.clientMilestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    return this.prisma.clientMilestone.update({
      where: { id: milestoneId },
      data: { assignedSquadId: squadId, status: milestone.status === 'PENDING' ? 'IN_PROGRESS' : milestone.status },
    });
  }

  /** BR-OTH-04: pre-delivery CTO gate. */
  async ctoAudit(ctoUserId: string, milestoneId: string, pass: boolean, notes?: string) {
    const milestone = await this.prisma.clientMilestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.status !== 'IN_PROGRESS' && milestone.status !== 'CTO_AUDIT') {
      throw new BadRequestException(`Milestone must be IN_PROGRESS for CTO audit (currently ${milestone.status})`);
    }

    if (pass) {
      return this.prisma.clientMilestone.update({
        where: { id: milestoneId },
        data: { ctoApproved: true, status: 'CLIENT_REVIEW' },
      });
    }
    return this.prisma.clientMilestone.update({
      where: { id: milestoneId },
      data: { ctoApproved: false, status: 'IN_PROGRESS' },
    });
  }

  /** Client acceptance triggers the escrow waterfall (BR-OTH-05). */
  async clientAccept(user: AuthUser, milestoneId: string, accepted: boolean, idempotencyKey: string) {
    const milestone = await this.prisma.clientMilestone.findUnique({
      where: { id: milestoneId },
      include: { contract: true, assignedSquad: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.status !== 'CLIENT_REVIEW') throw new BadRequestException('Milestone is not in client review');
    if (!milestone.ctoApproved) throw new AppException('CONFLICT', 'CTO approval required before client review (BR-OTH-04)');
    if (!milestone.assignedSquadId || !milestone.assignedSquad) throw new BadRequestException('Milestone has no assigned squad');

    if (user.role === UserRole.PM) {
      const m = await this.prisma.squadMembership.findFirst({
        where: { userId: user.id, squadId: milestone.assignedSquadId, role: 'PM', leftAt: null },
      });
      if (!m) throw new ForbiddenException('Only the assigned squad PM or an executive may record client acceptance');
    }

    if (!accepted) {
      await this.prisma.clientContract.update({
        where: { id: milestone.contractId },
        data: { status: ContractStatus.DISPUTED },
      });
      await this.prisma.clientMilestone.update({ where: { id: milestoneId }, data: { status: 'CTO_AUDIT' } });
      this.events.emitToStudio('client:disputed', { milestoneId, contractId: milestone.contractId });
      return { milestoneId, status: 'DISPUTED', escrowFrozen: true };
    }

    const payout = Number(milestone.payoutAmount);
    const contract = milestone.contract;
    if (Number(contract.escrowBalance) < payout) {
      throw new AppException('CONFLICT', 'Escrow balance insufficient — fund the milestone first (BR-OTH-02)');
    }

    const studioShare = Math.round(payout * Number(contract.studioReservePercent) * 100) / 100;
    const squadShare = Math.round(payout * Number(contract.squadSharePercent) * 100) / 100;
    const execShare = payout - studioShare - squadShare;

    const escrow = await this.ledger.escrow();
    const reserve = await this.ledger.systemReserve();
    const treasury = await this.ledger.squadTreasury(milestone.assignedSquadId);

    const entries: { accountId: string; direction: 'DEBIT' | 'CREDIT'; amount: number }[] = [
      { accountId: escrow.id, direction: 'DEBIT', amount: payout },
      { accountId: reserve.id, direction: 'CREDIT', amount: studioShare },
      { accountId: treasury.id, direction: 'CREDIT', amount: squadShare },
    ];

    // Executive overhead split equally among CFO / CTO / CPO (remainder-safe)
    const execs = await this.prisma.user.findMany({ where: { role: { in: ['CFO', 'CTO', 'CPO'] }, isActive: true } });
    const perExec = Math.floor((execShare / Math.max(execs.length, 1)) * 100) / 100;
    for (let i = 0; i < execs.length; i++) {
      const wallet = await this.ledger.personalWallet(execs[i].id);
      // last executive absorbs the rounding remainder so debits == credits exactly
      const amount = i === execs.length - 1 ? Math.round((execShare - perExec * (execs.length - 1)) * 100) / 100 : perExec;
      entries.push({ accountId: wallet.id, direction: 'CREDIT', amount });
    }

    await this.ledger.postTransaction({
      entries,
      referenceType: 'ESCROW_RELEASE',
      referenceId: milestone.id,
      description: `Milestone revenue waterfall — ${milestone.milestoneName}`,
      idempotencyKey: idempotencyKey || `milestone_${milestone.id}`,
      authorizedById: user.id,
    });

    // CFO equity dividend on squad net revenue (BR-CFO-15)
    const dividend = await this.equity.payDividendOnRevenue(milestone.assignedSquadId, squadShare, milestone.id);

    await this.prisma.clientContract.update({
      where: { id: milestone.contractId },
      data: { escrowBalance: { decrement: payout }, status: ContractStatus.ACTIVE },
    });
    await this.prisma.client.update({
      where: { id: milestone.contractId ? contract.clientId : undefined as any },
      data: { totalLifetimeValue: { increment: payout } },
    });
    const updated = await this.prisma.clientMilestone.update({
      where: { id: milestoneId },
      data: { clientAccepted: true, status: 'PAID' },
    });

    this.events.emitToRoom(this.events.squadRoom(milestone.assignedSquadId), 'milestone:paid', {
      milestoneId,
      squadShare,
      dividend: dividend?.dividend ?? 0,
    });

    return { ...updated, squadShare, studioShare, execSharePerExecutive: perExec, dividend: dividend?.dividend ?? 0 };
  }
}
