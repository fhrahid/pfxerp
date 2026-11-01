import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';
import { AppException } from '../../common/exceptions/app.exception';
import { UserRole } from '@prisma/client';
import { isExecRole, isOverrideRole } from '../../common/types';

/**
 * Dynamic squad topology (chro.md §2.1): elastic headcount, fractional
 * allocations, exactly one primary PM per squad, swap/fire fees.
 */
@Injectable()
export class SquadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
  ) {}

  async listSquads(user: { id: string; role: UserRole; squadIds: string[] }) {
    const isExec = isExecRole(user.role);
    const squads = await this.prisma.squad.findMany({
      where: {
        isActive: true,
        ...(isExec ? {} : { id: { in: user.squadIds.length ? user.squadIds : ['none'] } }),
      },
      include: { account: true, _count: { select: { memberships: { where: { leftAt: null } }, tasks: true } } },
      orderBy: { name: 'asc' },
    });
    return squads.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      healthStatus: s.healthStatus,
      valuation: Number(s.valuation),
      balance: s.account ? Number(s.account.balance) : 0,
      memberCount: s._count.memberships,
      taskCount: s._count.tasks,
    }));
  }

  async getSquad(user: { id: string; role: UserRole; squadIds: string[] }, squadId: string) {
    const isExec = isExecRole(user.role);
    if (!isExec && !user.squadIds.includes(squadId)) {
      throw new ForbiddenException('AUTHZ_CROSS_SQUAD');
    }
    const squad = await this.prisma.squad.findUnique({
      where: { id: squadId },
      include: {
        account: true,
        memberships: {
          where: { leftAt: null },
          include: { user: { select: { id: true, fullName: true, email: true, role: true, isActive: true } } },
        },
      },
    });
    if (!squad) throw new NotFoundException('Squad not found');
    return {
      id: squad.id,
      name: squad.name,
      description: squad.description,
      isActive: squad.isActive,
      healthStatus: squad.healthStatus,
      valuation: Number(squad.valuation),
      balance: squad.account ? Number(squad.account.balance) : 0,
      members: squad.memberships
        .filter((m) => m.user.isActive)
        .map((m) => ({
          membershipId: m.id,
          userId: m.user.id,
          fullName: m.user.fullName,
          email: m.user.email,
          role: m.role,
          allocation: Number(m.allocation),
        })),
    };
  }

  /** CPO/CEO: create a squad + treasury, optionally funded from SYSTEM_RESERVE. */
  async createSquad(user: { id: string }, dto: { name: string; description?: string; initialBalance?: number }) {
    const existing = await this.prisma.squad.findUnique({ where: { name: dto.name } });
    if (existing) throw new AppException('CONFLICT', `A squad named "${dto.name}" already exists`);

    const squad = await this.prisma.squad.create({
      data: { name: dto.name, description: dto.description },
    });
    await this.prisma.account.create({
      data: { squadId: squad.id, type: 'SQUAD_TREASURY', balance: 0, currency: 'BDT' },
    });

    const initial = dto.initialBalance ?? (await this.settings.getNumber('SQUAD_INITIAL_BALANCE', 100000));
    if (initial > 0) {
      const reserve = await this.ledger.systemReserve();
      const treasury = await this.ledger.squadTreasury(squad.id);
      await this.ledger.executeDoubleEntryTransfer({
        senderAccountId: reserve.id,
        recipientAccountId: treasury.id,
        amount: initial,
        referenceType: 'SQUAD_FUNDING',
        referenceId: squad.id,
        description: `Initial treasury funding for ${squad.name}`,
        idempotencyKey: `squad_funding_${squad.id}`,
        authorizedById: user.id,
      });
    }

    const fresh = await this.prisma.squad.findUnique({ where: { id: squad.id }, include: { account: true } });
    return {
      id: fresh!.id,
      name: fresh!.name,
      description: fresh!.description,
      isActive: fresh!.isActive,
      balance: fresh!.account ? Number(fresh!.account.balance) : 0,
    };
  }

  /** CPO/CEO: rename / re-describe / (de)activate a squad. */
  async updateSquad(squadId: string, dto: { name?: string; description?: string; isActive?: boolean }) {
    const squad = await this.prisma.squad.findUnique({ where: { id: squadId } });
    if (!squad) throw new NotFoundException('Squad not found');

    if (dto.name && dto.name !== squad.name) {
      const clash = await this.prisma.squad.findUnique({ where: { name: dto.name } });
      if (clash) throw new AppException('CONFLICT', `A squad named "${dto.name}" already exists`);
    }

    return this.prisma.squad.update({
      where: { id: squadId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  /** Sum of a user's active allocations must stay <= 1.0 (BR-CHRO-02). */
  private async assertAllocationBudget(userId: string, extraAllocation: number) {
    const agg = await this.prisma.squadMembership.aggregate({
      where: { userId, leftAt: null },
      _sum: { allocation: true },
    });
    const current = Number(agg._sum.allocation || 0);
    if (current + extraAllocation > 1.0 + 1e-9) {
      throw new BadRequestException(
        `Allocation budget exceeded: current ${current.toFixed(2)} + ${extraAllocation.toFixed(2)} > 1.00 (BR-CHRO-02)`,
      );
    }
  }

  /** CPO adds a member (BR-CHRO-01..04). PM role requires allocation 1.0 and squad must not already have a PM. */
  async addMember(cpoUserId: string, squadId: string, dto: { userId: string; role: 'PM' | 'DEVELOPER'; allocation: number }) {
    const squad = await this.prisma.squad.findUnique({ where: { id: squadId } });
    if (!squad) throw new NotFoundException('Squad not found');

    const existing = await this.prisma.squadMembership.findUnique({
      where: { userId_squadId: { userId: dto.userId, squadId } },
    });
    if (existing && !existing.leftAt) {
      throw new BadRequestException('User is already an active member of this squad');
    }

    if (dto.role === 'PM') {
      if (dto.allocation < 1.0 - 1e-9) {
        throw new BadRequestException('Squad PM must hold allocation = 1.0 (BR-CHRO-03)');
      }
      const hasPM = await this.prisma.squadMembership.findFirst({ where: { squadId, role: 'PM', leftAt: null } });
      if (hasPM) throw new BadRequestException('Squad already has a primary PM (BR-CHRO-03)');
    }

    await this.assertAllocationBudget(dto.userId, dto.allocation);

    const membership = await this.prisma.squadMembership.create({
      data: {
        userId: dto.userId,
        squadId,
        role: dto.role,
        allocation: dto.allocation,
        isPrimary: dto.role === 'PM',
      },
    });
    return membership;
  }

  /** CPO removes a member; the squad pays the SWAP_FEE (BR-CHRO-20..22). */
  async removeMember(cpoUserId: string, squadId: string, userId: string, idempotencyKey: string) {
    const membership = await this.prisma.squadMembership.findUnique({
      where: { userId_squadId: { userId, squadId } },
    });
    if (!membership || membership.leftAt) throw new NotFoundException('Active membership not found');

    const fee = await this.settings.getNumber('SWAP_FEE', 5000);
    const cutRate = await this.settings.getNumber('CPO_SWAP_CUT_RATE', 0.20);
    const cpoCut = Math.round(fee * cutRate * 100) / 100;
    const reserveCut = fee - cpoCut;

    const squadAcc = await this.ledger.squadTreasury(squadId);
    const cpoAcc = await this.ledger.personalWallet(cpoUserId);
    const reserveAcc = await this.ledger.systemReserve();

    await this.ledger.postTransaction({
      entries: [
        { accountId: squadAcc.id, direction: 'DEBIT', amount: fee },
        { accountId: cpoAcc.id, direction: 'CREDIT', amount: cpoCut },
        { accountId: reserveAcc.id, direction: 'CREDIT', amount: reserveCut },
      ],
      referenceType: 'SWAP_FEE',
      referenceId: membership.id,
      description: `Squad membership termination fee for user ${userId}`,
      idempotencyKey: idempotencyKey || `swapfee_${membership.id}_${Date.now()}`,
      authorizedById: cpoUserId,
    });

    return this.prisma.squadMembership.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });
  }

  /** CPO transfers a member between squads; destination squad pays the fee. */
  async transferMember(
    cpoUserId: string,
    dto: { userId: string; fromSquadId: string; toSquadId: string; allocation?: number },
    idempotencyKey: string,
  ) {
    if (dto.fromSquadId === dto.toSquadId) throw new BadRequestException('Source and destination squads identical');

    const membership = await this.prisma.squadMembership.findUnique({
      where: { userId_squadId: { userId: dto.userId, squadId: dto.fromSquadId } },
    });
    if (!membership || membership.leftAt) throw new NotFoundException('Active source membership not found');

    // Close old, open new
    await this.prisma.squadMembership.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });

    const allocation = dto.allocation ?? Number(membership.allocation);
    await this.assertAllocationBudget(dto.userId, allocation - Number(membership.allocation));

    const created = await this.prisma.squadMembership.create({
      data: {
        userId: dto.userId,
        squadId: dto.toSquadId,
        role: membership.role,
        allocation,
        isPrimary: membership.isPrimary,
      },
    });

    // Charge fee to destination squad treasury
    const fee = await this.settings.getNumber('SWAP_FEE', 5000);
    const cutRate = await this.settings.getNumber('CPO_SWAP_CUT_RATE', 0.20);
    const cpoCut = Math.round(fee * cutRate * 100) / 100;
    const reserveCut = fee - cpoCut;

    try {
      const squadAcc = await this.ledger.squadTreasury(dto.toSquadId);
      const cpoAcc = await this.ledger.personalWallet(cpoUserId);
      const reserveAcc = await this.ledger.systemReserve();
      await this.ledger.postTransaction({
        entries: [
          { accountId: squadAcc.id, direction: 'DEBIT', amount: fee },
          { accountId: cpoAcc.id, direction: 'CREDIT', amount: cpoCut },
          { accountId: reserveAcc.id, direction: 'CREDIT', amount: reserveCut },
        ],
        referenceType: 'SWAP_FEE',
        referenceId: created.id,
        description: `Squad transfer fee for user ${dto.userId}`,
        idempotencyKey: idempotencyKey || `swapfee_${created.id}_${Date.now()}`,
        authorizedById: cpoUserId,
      });
    } catch (err) {
      // Roll back the roster move if the fee could not be charged
      await this.prisma.squadMembership.delete({ where: { id: created.id } });
      await this.prisma.squadMembership.update({ where: { id: membership.id }, data: { leftAt: null } });
      throw err;
    }

    return created;
  }

  async assertMembership(userId: string, squadId: string) {
    const m = await this.prisma.squadMembership.findFirst({ where: { userId, squadId, leftAt: null } });
    if (!m) throw new ForbiddenException('AUTHZ_CROSS_SQUAD');
    return m;
  }

  async assertSquadPMOrExec(userId: string, role: UserRole, squadId: string) {
    if (isOverrideRole(role)) return;
    const m = await this.prisma.squadMembership.findFirst({ where: { userId, squadId, role: 'PM', leftAt: null } });
    if (!m) throw new ForbiddenException('Only the squad PM or an executive may perform this action');
    return m;
  }

  async pmOfSquad(squadId: string): Promise<string | null> {
    const m = await this.prisma.squadMembership.findFirst({ where: { squadId, role: 'PM', leftAt: null } });
    return m?.userId ?? null;
  }
}
