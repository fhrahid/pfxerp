import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Account, AccountType, LedgerDirection, LedgerTransaction, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { EventsGateway } from '../../events/events.gateway';

export interface LedgerEntryInput {
  accountId: string;
  direction: LedgerDirection;
  amount: number;
}

export interface PostTransactionParams {
  entries: LedgerEntryInput[];
  referenceType: TransactionType;
  referenceId?: string;
  description?: string;
  idempotencyKey: string;
  authorizedById: string;
  /** Accounts allowed to go negative (e.g. CTO reverse penalty, cto.md §14.5). */
  allowNegativeAccountIds?: Set<string>;
}

const GENESIS_HASH = '0'.repeat(64);

/**
 * Zero-trust double-entry ledger (security.md §5):
 *  - deterministic lexicographic row locking (FOR UPDATE) to kill race conditions
 *  - HMAC-SHA256 hash chaining (prevHash -> entryHash) for tamper evidence
 *  - idempotency keys with replay of the original transaction
 *  - frozen-account blocking and balance validation
 */
@Injectable()
export class LedgerService {
  private readonly secret: string = process.env.LEDGER_SECRET_KEY || 'pointfex-dev-ledger-secret';

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  // --------------------------------------------------------------
  // Hash chain primitives
  // --------------------------------------------------------------
  private computeEntryHash(prevHash: string, e: { accountId: string; direction: string; amount: number; createdAt: Date }): string {
    return createHmac('sha256', this.secret)
      .update(`${prevHash}:${e.accountId}:${e.direction}:${e.amount.toFixed(2)}:${e.createdAt.toISOString()}`)
      .digest('hex');
  }

  // --------------------------------------------------------------
  // Core posting engine
  // --------------------------------------------------------------
  async postTransaction(params: PostTransactionParams, transactionClient?: Prisma.TransactionClient): Promise<LedgerTransaction> {
    const { entries } = params;

    if (!entries.length) throw new BadRequestException('Transaction requires at least one entry');
    if (entries.some((e) => !(e.amount > 0))) {
      throw new BadRequestException('Transfer amounts must be strictly positive');
    }
    if (!params.idempotencyKey) {
      params.idempotencyKey = `auto_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    const totalDebit = round(entries.filter((e) => e.direction === 'DEBIT').reduce((a, e) => a + e.amount, 0));
    const totalCredit = round(entries.filter((e) => e.direction === 'CREDIT').reduce((a, e) => a + e.amount, 0));
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      throw new AppException(
        'LEDGER_UNBALANCED',
        `Unbalanced transaction: debits ${totalDebit.toFixed(2)} != credits ${totalCredit.toFixed(2)}`,
      );
    }

    const post = async (tx: Prisma.TransactionClient) => {
        const accountIds = [...new Set(entries.map((e) => e.accountId))].sort();
        // 1. Idempotency replay (main.md §7.3)
        const existing = await tx.ledgerTransaction.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
          include: { entries: true },
        });
        if (existing) {
          const originalAccountIds = [...new Set(existing.entries.map((entry) => entry.accountId))].sort();
          return { transaction: existing, accountIds: originalAccountIds };
        }

        // 2. Deterministic account locking, ascending id (security.md §5.1)
        const locked: Account[] = await tx.$queryRaw<Account[]>(Prisma.sql`
          SELECT id, balance, "isFrozen" FROM "Account"
          WHERE id::text IN (${Prisma.join(accountIds)})
          ORDER BY id ASC
          FOR UPDATE
        `);
        const byId = new Map(locked.map((a) => [a.id, a]));
        for (const id of accountIds) {
          if (!byId.has(id)) throw new BadRequestException(`Account ${id} does not exist`);
          if (byId.get(id)!.isFrozen) {
            throw new AppException('LEDGER_ACCOUNT_FROZEN', `Account ${id} is frozen by CEO order`, { accountId: id });
          }
        }

        // 3. Balance validation with per-account debit aggregation
        const debitTotals = new Map<string, number>();
        for (const e of entries.filter((x) => x.direction === 'DEBIT')) {
          debitTotals.set(e.accountId, round((debitTotals.get(e.accountId) || 0) + e.amount));
        }
        for (const [accountId, debit] of debitTotals) {
          if (params.allowNegativeAccountIds?.has(accountId)) continue; // cto.md §14.5
          const acc = byId.get(accountId)!;
          if (Number(acc.balance) < debit) {
            throw new AppException('LEDGER_INSUFFICIENT_FUNDS', `Account balance of BDT ${Number(acc.balance).toFixed(2)} is insufficient for debit of BDT ${debit.toFixed(2)}`, {
              accountId,
              availableBalance: Number(acc.balance),
              requestedAmount: debit,
            });
          }
        }

        // 4. Chain onto the latest entry
        const lastEntry = await tx.ledgerEntry.findFirst({ orderBy: { sequenceNumber: 'desc' } });
        let prevHash = lastEntry ? lastEntry.entryHash : GENESIS_HASH;

        // 5. Apply balances + build chained entries
        const creditTotals = new Map<string, number>();
        for (const e of entries.filter((x) => x.direction === 'CREDIT')) {
          creditTotals.set(e.accountId, round((creditTotals.get(e.accountId) || 0) + e.amount));
        }
        const deltas = new Map<string, number>();
        for (const [id, d] of debitTotals) deltas.set(id, -(d || 0));
        for (const [id, c] of creditTotals) deltas.set(id, (deltas.get(id) || 0) + c);
        for (const [accountId, delta] of deltas) {
          await tx.account.update({
            where: { id: accountId },
            data: { balance: { increment: new Prisma.Decimal(delta.toFixed(2)) } },
          });
        }

        const entryRows = entries.map((e) => {
          const createdAt = new Date();
          const entryHash = this.computeEntryHash(prevHash, { ...e, createdAt });
          const row = {
            accountId: e.accountId,
            direction: e.direction,
            amount: new Prisma.Decimal(e.amount.toFixed(2)),
            prevHash,
            entryHash,
            createdAt,
          };
          prevHash = entryHash;
          return row;
        });

        const transaction = await tx.ledgerTransaction.create({
          data: {
            idempotencyKey: params.idempotencyKey,
            referenceType: params.referenceType,
            referenceId: params.referenceId,
            description: params.description,
            authorizedById: params.authorizedById,
            entries: { create: entryRows },
          },
          include: { entries: true },
        });

        return { transaction, accountIds };
    };

    // A caller that owns a wider transaction also owns publishing its events.
    if (transactionClient) return (await post(transactionClient)).transaction;

    const result = await this.prisma.$transaction(post, { timeout: 15000 });
    await this.publishBalanceUpdates(result.accountIds);
    return result.transaction;
  }

  /** Publish account changes only after the transaction that wrote them committed. */
  async publishBalanceUpdates(accountIds: string[]) {
    const accounts = await this.prisma.account.findMany({ where: { id: { in: [...new Set(accountIds)] } } });
    for (const acc of accounts) {
      this.events.emitToRoom(`account:${acc.id}`, 'balance:updated', {
        accountId: acc.id,
        newBalance: Number(acc.balance),
        currency: acc.currency,
      });
    }
  }

  /** Simple two-sided transfer helper. */
  async executeDoubleEntryTransfer(params: {
    senderAccountId: string;
    recipientAccountId: string;
    amount: number;
    referenceType: TransactionType;
    referenceId?: string;
    description?: string;
    idempotencyKey: string;
    authorizedById: string;
    /** Sender may go negative (spec-sanctioned cases like reverse penalties). */
    allowNegative?: boolean;
  }) {
    return this.postTransaction({
      entries: [
        { accountId: params.senderAccountId, direction: 'DEBIT', amount: params.amount },
        { accountId: params.recipientAccountId, direction: 'CREDIT', amount: params.amount },
      ],
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      description: params.description,
      idempotencyKey: params.idempotencyKey,
      authorizedById: params.authorizedById,
      allowNegativeAccountIds: params.allowNegative ? new Set([params.senderAccountId]) : undefined,
    });
  }

  // --------------------------------------------------------------
  // Account resolution helpers
  // --------------------------------------------------------------
  private async byType(type: AccountType, client: Pick<Prisma.TransactionClient, 'account'> = this.prisma): Promise<Account> {
    const acc = await client.account.findFirst({ where: { type } });
    if (!acc) throw new BadRequestException(`${type} account is not provisioned`);
    return acc;
  }

  systemReserve(client?: Pick<Prisma.TransactionClient, 'account'>) {
    return this.byType(AccountType.SYSTEM_RESERVE, client);
  }

  escrow() {
    return this.byType(AccountType.ESCROW);
  }

  async personalWallet(userId: string, client: Pick<Prisma.TransactionClient, 'account'> = this.prisma): Promise<Account> {
    const acc = await client.account.findUnique({ where: { ownerId: userId } });
    if (!acc) throw new BadRequestException(`Personal wallet for user ${userId} is not provisioned`);
    return acc;
  }

  async squadTreasury(squadId: string, client: Pick<Prisma.TransactionClient, 'account'> = this.prisma): Promise<Account> {
    const acc = await client.account.findUnique({ where: { squadId } });
    if (!acc) throw new BadRequestException(`Squad treasury for squad ${squadId} is not provisioned`);
    return acc;
  }

  // --------------------------------------------------------------
  // CEO: one-click chain integrity verification (BR-CEO-10)
  // --------------------------------------------------------------
  async verifyChain() {
    const entries = await this.prisma.ledgerEntry.findMany({
      orderBy: { sequenceNumber: 'asc' },
    });

    let expectedPrev = GENESIS_HASH;
    const broken: number[] = [];

    for (const entry of entries) {
      const recomputed = this.computeEntryHash(entry.prevHash, {
        accountId: entry.accountId,
        direction: entry.direction,
        amount: Number(entry.amount),
        createdAt: entry.createdAt,
      });
      if (entry.prevHash !== expectedPrev || recomputed !== entry.entryHash) {
        broken.push(Number(entry.sequenceNumber));
      }
      expectedPrev = entry.entryHash;
    }

    return {
      totalEntriesVerified: entries.length,
      chainStatus: broken.length === 0 ? 'VALID' : 'TAMPERED',
      lastVerifiedSequence: entries.length ? Number(entries[entries.length - 1].sequenceNumber) : 0,
      brokenEntriesCount: broken.length,
      brokenSequences: broken,
    };
  }

  /** Public transaction feed for dashboards. */
  async recentTransactions(limit = 25) {
    const txs = await this.prisma.ledgerTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        entries: { include: { account: { select: { id: true, type: true, ownerId: true, squadId: true } } } },
        authorizedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    return txs;
  }

}
