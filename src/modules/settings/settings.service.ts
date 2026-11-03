import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { AccountType, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/types';

/**
 * Dynamic SystemSettings key-value configuration (main.md §8).
 * Values are cached in-memory and invalidated on write.
 */
@Injectable()
export class SettingsService {
  private cache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  private async raw(key: string): Promise<string | null> {
    if (this.cache.has(key)) return this.cache.get(key)!;
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!row) return null;
    this.cache.set(key, row.value);
    return row.value;
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const v = await this.raw(key);
    if (v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  async getString(key: string, fallback: string): Promise<string> {
    const v = await this.raw(key);
    return v === null ? fallback : v;
  }

  async getJSON<T>(key: string, fallback: T): Promise<T> {
    const v = await this.raw(key);
    if (v === null) return fallback;
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }

  async upsert(key: string, value: string, type: string) {
    const row = await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value, type },
      create: { key, value, type },
    });
    this.cache.set(key, value);
    return row;
  }

  async productionResetStatus() {
    const [reset, users, squads, tasks, transactions, loans, decisions, payroll, balances] = await Promise.all([
      this.prisma.productionResetLog.findUnique({ where: { id: 'PRE_LAUNCH_RESET_V1' }, select: { createdAt: true, resetBy: { select: { fullName: true } }, summary: true } }),
      this.prisma.user.count(), this.prisma.squad.count(), this.prisma.task.count(),
      this.prisma.ledgerTransaction.count(), this.prisma.loan.count(), this.prisma.boardDecision.count(),
      this.prisma.payrollProposal.count(),
      this.prisma.account.groupBy({ by: ['type'], _sum: { balance: true }, _count: { id: true } }),
    ]);
    return {
      enabled: process.env.ALLOW_CEO_DATA_RESET === 'true',
      alreadyExecuted: Boolean(reset),
      executedAt: reset?.createdAt ?? null,
      executedBy: reset?.resetBy?.fullName ?? null,
      previousSummary: reset?.summary ?? null,
      preview: {
        users, squads, tasks, transactions, loans, governanceDecisions: decisions, payrollProposals: payroll,
        balances: balances.map((a) => ({ type: a.type, accounts: a._count.id, total: Number(a._sum.balance || 0) })),
      },
    };
  }

  /**
   * One-time, explicitly enabled pre-launch reset. Keeps only the CEO, system
   * roles and business settings; resets all accounts to zero, removes all
   * operational tables and ledger history, then writes a permanent reset log.
   */
  async resetProductionData(caller: AuthUser, currentPassword: string, confirmation: string) {
    if (caller.role !== UserRole.CEO) throw new ForbiddenException('CEO only');
    if (process.env.ALLOW_CEO_DATA_RESET !== 'true') throw new ForbiddenException('Set ALLOW_CEO_DATA_RESET=true during the approved maintenance window to enable the one-time reset');
    if (confirmation !== 'RESET_DEVELOPMENT_DATA_TO_PRODUCTION') throw new BadRequestException('Confirmation phrase did not match');
    const ceo = await this.prisma.user.findUnique({ where: { id: caller.id } });
    if (!ceo || !ceo.isActive || ceo.role !== UserRole.CEO || !(await bcrypt.compare(currentPassword, ceo.passwordHash))) {
      throw new ForbiddenException('CEO password verification failed');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(730023, 1) IS NULL AS locked`;
      if (await tx.productionResetLog.findUnique({ where: { id: 'PRE_LAUNCH_RESET_V1' } })) {
        throw new ConflictException('The one-time production reset has already been executed');
      }
      const summary = {
        users: await tx.user.count(),
        squads: await tx.squad.count(),
        tasks: await tx.task.count(),
        ledgerTransactions: await tx.ledgerTransaction.count(),
        loans: await tx.loan.count(),
        boardDecisions: await tx.boardDecision.count(),
        payrollProposals: await tx.payrollProposal.count(),
        balances: (await tx.account.groupBy({ by: ['type'], _sum: { balance: true }, _count: { id: true } })).map((a) => ({
          type: a.type, accounts: a._count.id, total: Number(a._sum.balance || 0),
        })),
      };
      const preserved = new Set(['User', 'Role', 'SystemSetting', 'ProductionResetLog']);
      const tableNames = Prisma.dmmf.datamodel.models
        .filter((model) => !preserved.has(model.name))
        .map((model) => model.dbName || model.name)
        .map((name) => `"${name.replace(/"/g, '""')}"`);
      if (tableNames.length) await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames.join(', ')} RESTART IDENTITY CASCADE`);

      await tx.user.deleteMany({ where: { id: { not: ceo.id } } });
      await tx.role.deleteMany({ where: { isSystem: false } });
      await tx.systemSetting.upsert({ where: { key: 'CURRENT_SPRINT' }, update: { value: '1', type: 'NUMBER' }, create: { key: 'CURRENT_SPRINT', value: '1', type: 'NUMBER' } });
      await tx.account.createMany({ data: [
        { ownerId: ceo.id, type: AccountType.PERSONAL_WALLET, balance: 0, currency: 'BDT' },
        { type: AccountType.SYSTEM_RESERVE, balance: 0, currency: 'BDT' },
        { type: AccountType.ESCROW, balance: 0, currency: 'BDT' },
        { type: AccountType.CAPITAL_SOURCE, balance: 0, currency: 'BDT' },
      ] });
      await tx.productionResetLog.create({
        data: { id: 'PRE_LAUNCH_RESET_V1', resetById: ceo.id, summary },
      });
      return summary;
    }, { timeout: 60000 });
    this.invalidate();
    return { success: true, message: 'One-time production data reset completed; ledger and account balances now start clean at zero.', summary: result };
  }

  invalidate() {
    this.cache.clear();
  }

  async currentSprint(): Promise<number> {
    return this.getNumber('CURRENT_SPRINT', 1);
  }
}
