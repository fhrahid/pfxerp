/* Destructive reset test guarded to a purpose-created scratch database only. */
if (!String(process.env.DATABASE_URL || '').includes('/pfx_reset_scratch')) {
  throw new Error('Refusing to run: DATABASE_URL must target the dedicated pfx_reset_scratch database');
}
if (process.env.ALLOW_CEO_DATA_RESET !== 'true') throw new Error('ALLOW_CEO_DATA_RESET=true is required for this isolated reset test');

const { PrismaClient } = await import('@prisma/client');
const { SettingsService } = await import('../dist/src/modules/settings/settings.service.js');
const prisma = new PrismaClient();
try {
  const ceo = await prisma.user.findUnique({ where: { email: process.env.INITIAL_CEO_EMAIL || 'noor@seu.edu.bd' } });
  if (!ceo) throw new Error('Scratch database has no bootstrap CEO');
  const before = { users: await prisma.user.count(), squads: await prisma.squad.count(), tasks: await prisma.task.count() };
  if (!before.squads || !before.users) throw new Error('Expected demo data in scratch database before reset');

  const service = new SettingsService(prisma);
  const reset = await service.resetProductionData(
    { id: ceo.id, role: 'CEO', email: ceo.email, squadIds: [] },
    process.env.INITIAL_CEO_PASSWORD || 'PointfexCeo2026!',
    'RESET_DEVELOPMENT_DATA_TO_PRODUCTION',
  );
  const [users, squads, tasks, txs, accounts, resetLog] = await Promise.all([
    prisma.user.findMany({ select: { id: true, role: true } }), prisma.squad.count(), prisma.task.count(),
    prisma.ledgerTransaction.count(), prisma.account.findMany({ select: { type: true, balance: true, ownerId: true } }),
    prisma.productionResetLog.findUnique({ where: { id: 'PRE_LAUNCH_RESET_V1' } }),
  ]);
  if (users.length !== 1 || users[0].id !== ceo.id || users[0].role !== 'CEO') throw new Error('Reset did not retain only the CEO');
  if (squads || tasks || txs) throw new Error('Reset left business or ledger data behind');
  if (!resetLog) throw new Error('Permanent reset audit record missing');
  if (accounts.length !== 4 || accounts.some((a) => Number(a.balance) !== 0)) throw new Error(`Expected four empty system/CEO accounts, got ${JSON.stringify(accounts)}`);
  console.log(`PASS: reset cleared ${before.users} users/${before.squads} squads/${before.tasks} tasks and ledger; kept CEO, zeroed four accounts and retained permanent reset log.`);
} finally {
  await prisma.$disconnect();
}
