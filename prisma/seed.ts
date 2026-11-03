/* eslint-disable no-console */
// Pointfex ERP — Genesis Seeder (main.md §8, other.md §8)
//
// Two levels:
//   runBootstrapSeed() — production-safe: SystemSettings, SYSTEM_RESERVE, ESCROW,
//                        and a single CEO account from INITIAL_CEO_EMAIL /
//                        INITIAL_CEO_PASSWORD (random + printed if not provided).
//   runDemoSeed()      — local/dev demo dataset: CFO/CTO/CPO, 6 squads,
//                        PM + 4 developers each, CTO lifetime certifications.
//
// CLI:  node dist/prisma/seed.js            → bootstrap + demo (dev default)
//       SEED_DEMO=false node dist/seed.js   → bootstrap only
// API:  AUTO_SEED=true                      → bootstrap only
//       AUTO_SEED=true + SEED_DEMO=true     → bootstrap + demo
import '../src/env';
import { PrismaClient, AccountType, UserRole, SquadRole, CertificationType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { createHash, createHmac } from 'crypto';

const prisma = new PrismaClient();
const GENESIS_HASH = '0'.repeat(64);

/** Record a balanced, HMAC-chained opening entry for bootstrap reserve cash. */
async function recordReserveOpening(ceoId: string) {
  const secret = process.env.LEDGER_SECRET_KEY;
  if (!secret || secret.length < 64) throw new Error('LEDGER_SECRET_KEY is required to create the opening ledger entry');
  await prisma.$transaction(async (tx) => {
    // Serialize bootstrap against other replicas and all ledger posters.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(730023, 1) IS NULL AS locked`;
    const assets = await tx.account.findMany({ where: { type: { not: AccountType.CAPITAL_SOURCE } }, orderBy: { id: 'asc' } });
    const openingAssets: typeof assets = [];
    for (const account of assets) {
      if (Number(account.balance) > 0 && !(await tx.ledgerEntry.count({ where: { accountId: account.id } }))) openingAssets.push(account);
    }
    if (!openingAssets.length) return;
    // Only record positive balances not already represented in the chain.
    const amount = openingAssets.reduce((sum, account) => sum + Number(account.balance), 0);
    const capital = await tx.account.findFirst({ where: { type: AccountType.CAPITAL_SOURCE } }) ||
      await tx.account.create({ data: { type: AccountType.CAPITAL_SOURCE, balance: 0, currency: 'BDT' } });
    const last = await tx.ledgerEntry.findFirst({ orderBy: { sequenceNumber: 'desc' }, select: { entryHash: true } });
    let previous = last?.entryHash || GENESIS_HASH;
    const createdAt = new Date();
    const entries = [
      { accountId: capital.id, direction: 'DEBIT' as const, amount },
      ...openingAssets.map((asset) => ({ accountId: asset.id, direction: 'CREDIT' as const, amount: Number(asset.balance) })),
    ].map((entry) => {
      const entryHash = createHmac('sha256', secret)
        .update(`${previous}:${entry.accountId}:${entry.direction}:${entry.amount.toFixed(2)}:${createdAt.toISOString()}`)
        .digest('hex');
      const row = { ...entry, prevHash: previous, entryHash, createdAt };
      previous = entryHash;
      return row;
    });
    await tx.account.update({ where: { id: capital.id }, data: { balance: { decrement: amount } } });
    await tx.ledgerTransaction.create({
      data: {
        idempotencyKey: `genesis_opening_${createHash('sha256').update(openingAssets.map((a) => a.id).join(',')).digest('hex').slice(0, 24)}`,
        referenceType: 'CAPITAL_INJECTION', referenceId: 'GENESIS',
        description: 'Opening cash balances established at genesis bootstrap', authorizedById: ceoId,
        entries: { create: entries },
      },
    });
  });
}

async function upsertUser(data: { email: string; fullName: string; role: UserRole | string; studentId?: string; password: string }) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.upsert({
    where: { email: data.email },
    update: {},
    create: {
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      role: data.role,
      studentId: data.studentId ?? null,
      isActive: true,
    },
  });
  await prisma.account.upsert({
    where: { ownerId: user.id },
    update: {},
    create: { ownerId: user.id, type: AccountType.PERSONAL_WALLET, balance: 0, currency: 'BDT' },
  });
  return user;
}

/** Production-safe genesis: no demo users, no squads — just the economic substrate + CEO. */
export async function runBootstrapSeed() {
  console.log('--- Pointfex bootstrap seeding (production-safe) ---');

  // 0. Seed System Roles
  const defaultRoles = [
    { name: 'CEO', description: 'Chief Executive Officer' },
    { name: 'CFO', description: 'Chief Financial Officer' },
    { name: 'CTO', description: 'Chief Technology Officer' },
    { name: 'CPO', description: 'Chief Product Officer' },
    { name: 'PM', description: 'Project Manager' },
    { name: 'DEVELOPER', description: 'Software Developer' },
  ];
  for (const r of defaultRoles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { isSystem: true },
      create: { name: r.name, description: r.description, isSystem: true },
    });
  }

  // 1. CEO (Course Faculty) — credentials from env; random password printed if not provided
  const ceoEmail = process.env.INITIAL_CEO_EMAIL || 'noor@seu.edu.bd';
  const ceoPassword = process.env.INITIAL_CEO_PASSWORD || randomBytes(12).toString('hex');
  const ceo = await upsertUser({ email: ceoEmail, fullName: 'Chief Executive Officer', role: UserRole.CEO, password: ceoPassword });

  // 2. System Reserve + Escrow accounts
  const reserveFund = Number(process.env.INITIAL_SYSTEM_RESERVE_FUND || 5000000);
  let systemReserve = await prisma.account.findFirst({ where: { type: AccountType.SYSTEM_RESERVE } });
  if (!systemReserve) {
    systemReserve = await prisma.account.create({
      data: { type: AccountType.SYSTEM_RESERVE, balance: reserveFund, currency: 'BDT' },
    });
  }
  let escrow = await prisma.account.findFirst({ where: { type: AccountType.ESCROW } });
  if (!escrow) {
    escrow = await prisma.account.create({ data: { type: AccountType.ESCROW, balance: 0, currency: 'BDT' } });
  }

  // 3. Core System Settings
  const defaultSettings: { key: string; value: string; type: string }[] = [
    { key: 'WEEKLY_LAB_BUDGET', value: '10000', type: 'NUMBER' },
    { key: 'SPRINT_POOL_TOTAL', value: '150000', type: 'NUMBER' },
    { key: 'SPRINT_PAYOUT_DISTRIBUTION', value: '[50000,35000,25000,20000,15000,5000]', type: 'JSON' },
    { key: 'CFO_TAX_RATE', value: '0.05', type: 'NUMBER' },
    { key: 'LOAN_INTEREST_RATE', value: '0.15', type: 'NUMBER' },
    { key: 'LOAN_THRESHOLD_BALANCE', value: '15000', type: 'NUMBER' },
    { key: 'EQUITY_STAKE_PERCENT', value: '0.10', type: 'NUMBER' },
    { key: 'EQUITY_DIVIDEND_RATE', value: '0.10', type: 'NUMBER' },
    { key: 'CFO_PENALTY_INCENTIVE', value: '0.20', type: 'NUMBER' },
    { key: 'CODE_AUDIT_FINE', value: '2000', type: 'NUMBER' },
    { key: 'CTO_AUDIT_FINE_CUT', value: '1000', type: 'NUMBER' },
    { key: 'CONSULTANCY_FEE', value: '4000', type: 'NUMBER' },
    { key: 'CTO_CONSULTANCY_CUT_RATE', value: '0.50', type: 'NUMBER' },
    { key: 'SLACKER_FINE', value: '2000', type: 'NUMBER' },
    { key: 'CPO_SLACKER_CUT', value: '500', type: 'NUMBER' },
    { key: 'SWAP_FEE', value: '5000', type: 'NUMBER' },
    { key: 'CPO_SWAP_CUT_RATE', value: '0.20', type: 'NUMBER' },
    { key: 'CRITICAL_BUG_BOUNTY', value: '5000', type: 'NUMBER' },
    { key: 'MAJOR_BUG_BOUNTY', value: '3000', type: 'NUMBER' },
    { key: 'MINOR_BUG_BOUNTY', value: '1000', type: 'NUMBER' },
    { key: 'LOW_BUG_BOUNTY', value: '500', type: 'NUMBER' },
    { key: 'BLIND_QA_PENALTY', value: '15000', type: 'NUMBER' },
    { key: 'REVERSE_AUDIT_FINE', value: '4000', type: 'NUMBER' },
    { key: 'PM_LEADERSHIP_BONUS_RATE', value: '0.10', type: 'NUMBER' },
    { key: 'MAX_CONSULTANCY_SESSIONS_PER_USER_PER_WEEK', value: '2', type: 'NUMBER' },
    { key: 'MAX_MARKETPLACE_PURCHASES_PER_SQUAD_PER_ASSET', value: '1', type: 'NUMBER' },
    { key: 'MAX_BUG_BOUNTY_CLAIMS_PER_USER_PER_SPRINT', value: '5', type: 'NUMBER' },
    { key: 'BUG_BOUNTY_CAP_PERCENT_OF_TARGET_BALANCE', value: '0.25', type: 'NUMBER' },
    { key: 'CROSS_SQUAD_BOUNTY_COOLDOWN_SPRINTS', value: '2', type: 'NUMBER' },
    { key: 'CERTIFICATION_PASS_THRESHOLD', value: '80', type: 'NUMBER' },
    { key: 'CERTIFICATION_COOLDOWN_DAYS', value: '7', type: 'NUMBER' },
    { key: 'CERTIFICATION_VALIDITY_DAYS', value: '90', type: 'NUMBER' },
    { key: 'CURRENT_SPRINT', value: '1', type: 'NUMBER' },
    { key: 'VALUATION_MAU_BETA', value: '100', type: 'NUMBER' },
    { key: 'VALUATION_API_ALPHA', value: '0.05', type: 'NUMBER' },
  ];
  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  await recordReserveOpening(ceo.id);

  console.log(`CEO account: ${ceoEmail} / ${process.env.INITIAL_CEO_PASSWORD ? '(password from INITIAL_CEO_PASSWORD)' : ceoPassword}`);
  console.log(`System Reserve: BDT ${systemReserve.balance} | Escrow account: provisioned`);
}

/** Local/dev demo dataset — NOT used in production deployments. */
export async function runDemoSeed() {
  console.log('--- Pointfex demo dataset (dev only) ---');
  const MEMBER_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Pointfex2026!';

  // Executive board (Team 0)
  const cfo = await upsertUser({ email: 'cfo@seu.edu.bd', fullName: 'Farhan Rahman (CFO)', role: UserRole.CFO, studentId: 'CSE001', password: MEMBER_PASSWORD });
  const cto = await upsertUser({ email: 'cto@seu.edu.bd', fullName: 'Nafisa Ahmed (CTO)', role: UserRole.CTO, studentId: 'CSE002', password: MEMBER_PASSWORD });
  await upsertUser({ email: 'cpo@seu.edu.bd', fullName: 'Rafiul Karim (CPO)', role: UserRole.CPO, studentId: 'CSE003', password: MEMBER_PASSWORD });

  // CTO auto-certifications (BR-CTO-34, BR-CTO-40: lifetime preapproval)
  for (const t of [CertificationType.CONSULTANT, CertificationType.MARKETPLACE_AUTHOR, CertificationType.SECURITY_RESEARCHER]) {
    await prisma.ctoProviderCertification.upsert({
      where: { userId_certificationType: { userId: cto.id, certificationType: t } },
      update: {},
      create: {
        userId: cto.id,
        certificationType: t,
        qualityScore: 100,
        isPreapproved: true,
        reviewedById: cto.id,
        certifiedAt: new Date(),
        expiresAt: null, // lifetime
      },
    });
  }

  // 6 product squads: treasury + 1 PM + 4 developers each
  const initialBalance = 0;
  let studentSeq = 4;
  for (let i = 1; i <= 6; i++) {
    const squad = await prisma.squad.upsert({
      where: { name: `Squad ${i}` },
      update: {},
      create: { name: `Squad ${i}`, description: `Product Engineering Squad ${i}`, valuation: initialBalance },
    });
    await prisma.account.upsert({
      where: { squadId: squad.id },
      update: {},
      create: { squadId: squad.id, type: AccountType.SQUAD_TREASURY, balance: initialBalance, currency: 'BDT' },
    });

    const pm = await upsertUser({
      email: `pm${i}@seu.edu.bd`, fullName: `PM Squad ${i}`, role: UserRole.PM,
      studentId: `CSE${String(studentSeq++).padStart(3, '0')}`, password: MEMBER_PASSWORD,
    });
    await prisma.squadMembership.upsert({
      where: { userId_squadId: { userId: pm.id, squadId: squad.id } },
      update: {},
      create: { userId: pm.id, squadId: squad.id, role: SquadRole.PM, allocation: 1.0, isPrimary: true },
    });

    for (let j = 1; j <= 4; j++) {
      const dev = await upsertUser({
        email: `dev${i}_${j}@seu.edu.bd`, fullName: `Dev ${i}-${j}`, role: UserRole.DEVELOPER,
        studentId: `CSE${String(studentSeq++).padStart(3, '0')}`, password: MEMBER_PASSWORD,
      });
      await prisma.squadMembership.upsert({
        where: { userId_squadId: { userId: dev.id, squadId: squad.id } },
        update: {},
        create: { userId: dev.id, squadId: squad.id, role: SquadRole.DEVELOPER, allocation: 1.0, isPrimary: true },
      });
    }
  }

  // Seed demo product for Squad 1
  const squad1 = await prisma.squad.findUnique({ where: { name: 'Squad 1' } });
  if (squad1) {
    await prisma.product.upsert({
      where: { apiKey: 'pfx_demo_squad_1_key' },
      update: {},
      create: {
        squadId: squad1.id,
        name: 'Squad 1 Flagship SaaS',
        liveUrl: 'https://squad1.pointfex.dev',
        apiKey: 'pfx_demo_squad_1_key',
        isClientProduct: false,
      },
    });
  }

  console.log(`Demo dataset ready: execs + 6 squads (PM + 4 devs each), member password: ${MEMBER_PASSWORD}`);
}

/** Legacy full seed (bootstrap + demo) — used by `npm run prisma:seed` in dev. */
export async function runSeed() {
  await runBootstrapSeed();
  await runDemoSeed();
}

async function main() {
  await runBootstrapSeed();
  if (process.env.SEED_DEMO !== 'false') {
    await runDemoSeed();
  } else {
    console.log('SEED_DEMO=false — skipping demo dataset (bootstrap only)');
  }
}

// Only auto-run when executed directly (npm run prisma:seed / node dist/prisma/seed.js).
// When the API imports runBootstrapSeed()/runSeed() for AUTO_SEED, this is skipped.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
