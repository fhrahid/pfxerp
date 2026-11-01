/* eslint-disable no-console */
// Pointfex ERP — Genesis Seeder (main.md §8, other.md §8)
import '../src/env';
import { PrismaClient, AccountType, UserRole, DeveloperTier, SquadRole, CertificationType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = process.env.INITIAL_CEO_PASSWORD || 'PointfexCeo2026!';
const MEMBER_PASSWORD = 'Pointfex2026!';
const SQUAD_COUNT = 6;
const DEVS_PER_SQUAD = 4; // 1 PM + 4 devs = 5 per squad => 30 students + 3 execs = 33

async function upsertUser(data: {
  email: string;
  fullName: string;
  role: UserRole;
  tier?: DeveloperTier;
  studentId?: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.upsert({
    where: { email: data.email },
    update: {},
    create: {
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      role: data.role,
      tier: data.tier ?? null,
      studentId: data.studentId ?? null,
      isActive: true,
    },
  });
  // Provision personal wallet
  await prisma.account.upsert({
    where: { ownerId: user.id },
    update: {},
    create: { ownerId: user.id, type: AccountType.PERSONAL_WALLET, balance: 0, currency: 'BDT' },
  });
  return user;
}

async function main() {
  await runSeed();
}

export async function runSeed() {
  console.log('--- Initializing Pointfex Genesis Seeding ---');

  // 1. CEO (Course Faculty)
  const ceo = await upsertUser({
    email: process.env.INITIAL_CEO_EMAIL || 'noor@seu.edu.bd',
    fullName: 'Asaduzzaman Noor (Course Faculty)',
    role: UserRole.CEO,
    password: DEFAULT_PASSWORD,
  });

  // 2. Executive Board (Team 0)
  const cfo = await upsertUser({ email: 'cfo@pointfex.dev', fullName: 'Ferdous Hasan Rahid (CFO)', role: UserRole.CFO, password: MEMBER_PASSWORD, studentId: 'CSE001' });
  const cto = await upsertUser({ email: 'cto@pointfex.dev', fullName: 'A R M Abir (CTO)', role: UserRole.CTO, password: MEMBER_PASSWORD, studentId: 'CSE002' });
  const cpo = await upsertUser({ email: 'cpo@pointfex.dev', fullName: 'Soyeb Naim (CPO)', role: UserRole.CPO, password: MEMBER_PASSWORD, studentId: 'CSE003' });

  // 3. System Reserve + Escrow accounts
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

  // 4. Core System Settings
  const defaultSettings: { key: string; value: string; type: string }[] = [
    { key: 'SQUAD_INITIAL_BALANCE', value: '100000', type: 'NUMBER' },
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

  // 5. CTO auto-certifications (BR-CTO-34, BR-CTO-40: lifetime preapproval)
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

  // 6. Product Squads 1..6 with treasuries + memberships
  const initialBalance = Number(defaultSettings.find((s) => s.key === 'SQUAD_INITIAL_BALANCE')!.value);
  const tiers = [DeveloperTier.TIER_A, DeveloperTier.TIER_B, DeveloperTier.TIER_C, DeveloperTier.TIER_D];
  let studentSeq = 4;

  for (let i = 1; i <= SQUAD_COUNT; i++) {
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
      email: `pm${i}@pointfex.dev`,
      fullName: `PM Squad ${i}`,
      role: UserRole.PM,
      tier: DeveloperTier.TIER_A,
      studentId: `CSE${String(studentSeq++).padStart(3, '0')}`,
      password: MEMBER_PASSWORD,
    });
    await prisma.squadMembership.upsert({
      where: { userId_squadId: { userId: pm.id, squadId: squad.id } },
      update: {},
      create: { userId: pm.id, squadId: squad.id, role: SquadRole.PM, allocation: 1.0, isPrimary: true },
    });

    for (let j = 1; j <= DEVS_PER_SQUAD; j++) {
      const dev = await upsertUser({
        email: `dev${i}_${j}@pointfex.dev`,
        fullName: `Dev ${i}-${j}`,
        role: UserRole.DEVELOPER,
        tier: tiers[(j - 1) % tiers.length],
        studentId: `CSE${String(studentSeq++).padStart(3, '0')}`,
        password: MEMBER_PASSWORD,
      });
      await prisma.squadMembership.upsert({
        where: { userId_squadId: { userId: dev.id, squadId: squad.id } },
        update: {},
        create: { userId: dev.id, squadId: squad.id, role: SquadRole.DEVELOPER, allocation: 1.0, isPrimary: true },
      });
    }
  }

  console.log('--- Pointfex Genesis Seeding Completed ---');
  console.log(`CEO:  ${ceo.email} / ${DEFAULT_PASSWORD}`);
  console.log(`CFO:  ${cfo.email} / ${MEMBER_PASSWORD}`);
  console.log(`CTO:  ${cto.email} / ${MEMBER_PASSWORD}`);
  console.log(`CPO:  ${cpo.email} / ${MEMBER_PASSWORD}`);
  console.log(`PMs:  pm1..pm${SQUAD_COUNT}@pointfex.dev / ${MEMBER_PASSWORD}`);
  console.log(`Devs: dev{squad}_{1..4}@pointfex.dev / ${MEMBER_PASSWORD}`);
  console.log(`System Reserve: BDT ${systemReserve.balance} | Squad treasuries: BDT ${initialBalance} each`);
}

// Only auto-run when executed directly (npm run prisma:seed / node dist/prisma/seed.js).
// When the API imports runSeed() for AUTO_SEED, this block is skipped.
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