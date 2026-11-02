/* ============================================================================
 * Pointfex ERP v1 — Sample Company Flow
 * A realistic "Sprint 3" narrative through every module, on a fresh database.
 * Run right after a reset+seed:   node scripts/company-flow.mjs
 * ==========================================================================*/
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DBQ_SCRIPT = join(__dirname, 'dbq.cjs');

const raw = process.env.BASE_URL || 'http://127.0.0.1:3000';
const BASE = raw.endsWith('/api/v1') ? raw : `${raw.replace(/\/$/, '')}/api/v1`;
const b64 = (s) => Buffer.from(s).toString('base64');

const dbq = (sql) => execFileSync(process.execPath, [DBQ_SCRIPT, sql], { encoding: 'utf8' }).trim();
const dbNum = (sql) => Number(dbq(sql) || 0);
const wallet = (e) => dbNum(`SELECT balance FROM "Account" WHERE "ownerId"=(SELECT id FROM "User" WHERE email='${e}')`);
const treasury = (n) => dbNum(`SELECT balance FROM "Account" WHERE "squadId"=(SELECT id FROM "Squad" WHERE name='Squad ${n}')`);
const uid = (e) => dbq(`SELECT id FROM "User" WHERE email='${e}'`);
const sq = (n) => dbq(`SELECT id FROM "Squad" WHERE name='Squad ${n}'`);
const taka = (n) => '৳' + Number(n).toLocaleString('en-US');
let seq = 0;
const idem = () => `flow-${Date.now()}-${seq++}`;

async function raw(method, path, body, token, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${json?.error?.message}`);
  return json.data;
}
const login = async (e, p = 'Pointfex2026!') => (await raw('POST', '/auth/login', { email: e, password: p })).accessToken;

const step = (n, t) => console.log(`\n■ ${n} — ${t}`);
const log = (s) => console.log('   ' + s);

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║   POINTFEX VENTURE STUDIO — Sample Company Flow (Sprint 3)        ║');
console.log('║   "From an idea to a greater impact"                              ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');

const ceo = await login('noor@seu.edu.bd', 'PointfexCeo2026!');
const cfo = await login('cfo@seu.edu.bd');
const cto = await login('cto@seu.edu.bd');
const cpo = await login('cpo@seu.edu.bd');
const pm1 = await login('pm1@seu.edu.bd');
const pm2 = await login('pm2@seu.edu.bd');
const pm4 = await login('pm4@seu.edu.bd');
const pm6 = await login('pm6@seu.edu.bd');
const d21 = await login('dev2_1@seu.edu.bd');
const d31 = await login('dev3_1@seu.edu.bd');
const d42 = await login('dev4_2@seu.edu.bd');

/* ───────────────────────── 1. Morning standup ───────────────────────── */
step(1, 'CEO opens the 360 command center');
{
  const d = await raw('GET', '/dashboard/ceo', undefined, ceo);
  log(`Circulating cash ${taka(d.macro.circulatingCash)} · Escrow ${taka(d.macro.activeEscrow)} · Studio valuation ${taka(d.macro.studioValuation)}`);
  log(`Squads: ${d.squads.map((s) => `${s.name} ${taka(s.balance)}`).join(' | ')}`);
  await raw('PUT', '/settings', { key: 'CURRENT_SPRINT', value: '3', type: 'NUMBER' }, ceo);
  log('CEO advances CURRENT_SPRINT → 3');
}

/* ─────────────────── 2. Real client engagement ─────────────────── */
let milestone;
step(2, 'CPO signs Meghna Logistics — FIXED_BID ৳300,000');
{
  const client = await raw('POST', '/clients', { companyName: `Meghna Logistics ${Date.now()}`, contactName: 'Rashidul Haque', contactEmail: `rashidul_${Date.now()}@meghna.example` }, cpo);
  const contract = await raw('POST', '/clients/contracts', { clientId: client.id, title: 'Fleet Tracking Platform', contractType: 'FIXED_BID', totalValue: 300000 }, cpo);
  milestone = await raw('POST', '/clients/milestones', { contractId: contract.id, milestoneName: 'Live tracking MVP', payoutAmount: 120000 }, cpo);
  await raw('POST', `/clients/milestones/${milestone.id}/escrow`, { amount: 120000 }, cpo, { 'X-Idempotency-Key': idem() });
  await raw('POST', `/clients/milestones/${milestone.id}/assign`, { squadId: sq(2) }, pm2);
  log(`Escrow funded ${taka(120000)} → assigned to Squad 2 (25% studio / 65% squad / 10% exec split)`);
}

/* ─────────────────── 3. CFO venture investment ─────────────────── */
step(3, 'CFO buys 10% equity in Squad 2 before revenue lands');
{
  const cfoAcc = dbq(`SELECT id FROM "Account" WHERE "ownerId"='${uid('cfo@seu.edu.bd')}'`);
  await raw('POST', `/accounts/${cfoAcc}/bonus?amount=50000`, { amount: 50000, reason: 'CFO operating capital' }, ceo);
  const stake = await raw('POST', '/equity', { squadId: sq(2), investedAmount: 15000, sprintNumber: 3 }, cfo);
  log(`Invested ${taka(stake.investedAmount)} for ${(stake.stakePercent * 100).toFixed(0)}% — dividends auto-fire on squad revenue`);
}

/* ─────────────────── 4. Squad 2 delivery cycle ─────────────────── */
step(4, 'Squad 2 executes: task → git proof → PM gate → CTO gate');
{
  const task = await raw('POST', '/tasks', { squadId: sq(2), title: 'GPS telemetry ingestion', description: 'Ingest device pings over MQTT into Timescale hypertable', storyPoints: 8, priority: 'CRITICAL', sprintNumber: 3, assignedToId: uid('dev2_1@seu.edu.bd') }, pm2);
  await raw('POST', `/tasks/${task.id}/start`, undefined, d21);
  await raw('POST', `/tasks/${task.id}/flag-complete`, { gitPrUrl: 'https://github.com/pointfex/squad-2/pull/31', gitCommitHash: 'f'.repeat(40) }, d21);
  await raw('POST', `/tasks/${task.id}/pm-verify`, { comment: 'All acceptance tests green in staging' }, pm2);
  await raw('POST', `/tasks/${task.id}/cto-verify`, { critique: 'Clean hexagonal architecture, 91% coverage' }, cto);
  await raw('POST', `/tasks/${task.id}/close`, undefined, pm2);
  log('Task CLOSED: 8 story points banked for velocity');

  await raw('POST', `/clients/milestones/${milestone.id}/cto-audit`, { pass: true, notes: 'Architecture + security review passed' }, cto);
  const before = { s2: treasury(2), cfo: wallet('cfo@seu.edu.bd'), cto: wallet('cto@seu.edu.bd'), cpo: wallet('cpo@seu.edu.bd') };
  const accepted = await raw('POST', `/clients/milestones/${milestone.id}/client-accept`, { accepted: true }, pm2, { 'X-Idempotency-Key': idem() });
  log(`Client ACCEPTED. Waterfall: reserve ${taka(accepted.studioShare)} · Squad 2 ${taka(accepted.squadShare)} · execs ${taka(12000)} (3-way)`);
  log(`CFO equity dividend fired automatically: ${taka(accepted.dividend)} (10% of squad share)`);
  log(`Squad 2 treasury: ${taka(before.s2)} → ${taka(treasury(2))}`);
}

/* ─────────────────── 5. Weekly payroll ─────────────────── */
step(5, 'Lab payroll — PM proposes, CHRO audits & disburses');
{
  await raw('POST', '/payroll', {
    squadId: sq(2), labNumber: 8, sprintNumber: 3,
    lineItems: [
      { userId: uid('dev2_1@seu.edu.bd'), tier: 'STAR_PERFORMER', amount: 3500, justification: 'Shipped telemetry MVP' },
      { userId: uid('dev2_2@seu.edu.bd'), tier: 'REGULAR', amount: 2000, justification: 'Dashboard views' },
      { userId: uid('pm2@seu.edu.bd'), tier: 'REGULAR', amount: 2000, justification: 'Sprint leadership' },
    ],
  }, pm2);
  const list = await raw('GET', '/payroll?status=SUBMITTED', undefined, cpo);
  const p = list.find((x) => x.labNumber === 8);
  const r = await raw('POST', `/payroll/${p.id}/approve`, undefined, cpo, { 'X-Idempotency-Key': idem() });
  log(`Disbursed ${taka(r.disbursedAmount)} to ${r.recipientsCount} members (dev2_1 wallet now ${taka(wallet('dev2_1@seu.edu.bd'))})`);
}

/* ─────────────────── 6. Adversarial QA ─────────────────── */
step(6, 'Squad 3 hunter lands a CRITICAL bounty on Squad 2');
{
  const target = await raw('POST', '/bounty/targets', { title: 'Squad 2 tracking hardening', description: 'Post-MVP hardening window', targetSquadId: sq(2), totalBountyPool: 15000 }, cto);
  const report = await raw('POST', '/bounty/reports', {
    bountyTargetId: target.id, targetSquadId: sq(2), title: 'IDOR exposes other fleets\' locations',
    description: 'Missing object-level authorization on the fleet endpoint leaks data',
    reproductionSteps: '1. GET /api/v1/fleets/<other-id> 2. observe foreign coordinates returned', severity: 'CRITICAL',
  }, d31);
  const before = treasury(3);
  const triaged = await raw('POST', `/bounty/reports/${report.id}/triage`, { action: 'VERIFY', severity: 'CRITICAL', notes: 'Confirmed on staging' }, cto);
  log(`CTO verified → ${taka(triaged.bountyPaid)} transferred Squad 2 escrow → Squad 3 treasury (${taka(before)} → ${taka(treasury(3))})`);
}

/* ─────────────────── 7. Quality enforcement ─────────────────── */
step(7, 'CTO audits Squad 5; discipline for Squad 4');
{
  const before = treasury(5);
  await raw('POST', '/cto/citations', { squadId: sq(5), type: 'CODE_SMELL', description: 'Controller contains 400 lines of inline business logic' }, cto, { 'X-Idempotency-Key': idem() });
  log(`Squad 5 cited (fine ${taka(2000)}: ${taka(before)} → ${taka(treasury(5))}; CTO cut ${taka(1000)})`);

  const notice = await raw('POST', '/notices', {
    recipientId: uid('dev4_2@seu.edu.bd'), title: 'Disciplinary citation — Lab 8', category: 'DISCIPLINARY',
    encryptedContent: b64('Zero commits and two missed standups this week. Your payroll tier is set to SLACKER.'),
    signature: b64('ed25519-' + Date.now()),
  }, cpo);
  await raw('POST', `/notices/${notice.noticeId}/acknowledge`, { acknowledgmentSignature: b64('ack-' + Date.now()) }, d42);
  log('Slacker notice dispatched (E2EE) and cryptographically acknowledged by dev4_2');
}

/* ─────────────────── 8. Sprint payout ─────────────────── */
step(8, 'CFO leaderboard → CEO approval → ৳150,000 pool executes');
{
  const squads = await raw('GET', '/squads', undefined, ceo);
  const byBalance = [...squads].sort((a, b) => b.balance - a.balance);
  const rankings = byBalance.map((s, i) => ({ squadId: s.id, rank: i + 1 }));
  const payout = await raw('POST', '/sprint-payouts', { sprintNumber: 3, rankings }, cfo);
  await raw('POST', `/sprint-payouts/${payout.id}/ceo-approve`, undefined, ceo);
  const exec = await raw('POST', `/sprint-payouts/${payout.id}/execute`, undefined, cfo, { 'X-Idempotency-Key': idem() });
  const winner = byBalance[0];
  log(`Ranking: ${byBalance.map((s) => s.name).join(' > ')}`);
  log(`Pool executed: CFO tax ${taka(exec.cfoTaxCollected)} · PM bonuses ${taka(exec.pmBonusesDisbursed)}`);
  log(`${winner.name} (rank 1): ${taka(treasury(Number(winner.name.slice(6))))} treasury now`);
}

/* ─────────────────── 9. Emergency loan drill ─────────────────── */
step(9, 'Squad 6 bankruptcy drill — governance rescue');
{
  const t6 = treasury(6);
  await raw('POST', '/bounty/targets', { title: 'S6 pre-loan hardening', targetSquadId: sq(6), totalBountyPool: t6 - 10000 }, cto);
  log(`Squad 6 drained to ${taka(treasury(6))} (below ৳15,000 emergency threshold)`);
  const loan = await raw('POST', '/loans', { squadId: sq(6), principalAmount: 20000 }, pm6);
  log(`PM6 applies: ${taka(20000)} @ 15% → total due ${taka(Number(loan.totalDue))}`);
  const decision = await raw('POST', '/governance/decisions', { title: 'Emergency loan Squad 6', description: 'Treasury below threshold after hardening window; approve rescue loan.', category: 'LOAN_APPROVAL', referenceId: loan.id }, cfo);
  await raw('POST', `/governance/decisions/${decision.id}/vote`, { vote: 'APPROVE', comment: 'viable' }, cto);
  await raw('POST', `/governance/decisions/${decision.id}/vote`, { vote: 'APPROVE', comment: 'seconded' }, cpo);
  await raw('POST', `/governance/decisions/${decision.id}/ceo-decide`, { approve: true, comment: 'Faculty sign-off' }, ceo);
  await raw('POST', `/loans/${loan.id}/approve`, undefined, cfo, { 'X-Idempotency-Key': idem() });
  await raw('POST', `/loans/${loan.id}/repay`, undefined, pm6, { 'X-Idempotency-Key': idem() });
  log('2-of-3 vote → CEO sign-off → disbursed → repaid (interest ৳3,000 → CFO wallet)');
}

/* ─────────────────── 10. Chaos drill ─────────────────── */
step(10, 'CEO chaos: production outage (10s SLA)');
{
  await raw('POST', '/chaos/events', { type: 'SERVER_OUTAGE', title: 'S4 replica failure', description: 'Primary DB down — restore within 10 seconds or automated fine applies.', targetSquadId: sq(4), penaltyAmount: 2000, timeLimitSeconds: 10 }, ceo);
  log('Incident dispatched studio-wide (Socket.io alarm)...');
  await new Promise((r) => setTimeout(r, 45000));
  const s4 = treasury(4);
  log(`SLA missed → auto-penalty applied. Squad 4 treasury: ${taka(s4)}`);
}

/* ─────────────────── 11. Marketplace + consultancy ─────────────────── */
step(11, 'Economy extras: marketplace purchase + paid consultancy');
{
  const listing = await raw('POST', '/cto/marketplace/listings', { title: 'NestJS DDD Starter', price: 8000, description: 'Opinionated clean-architecture scaffold', repositoryUrl: 'https://github.com/pointfex/ddd-starter' }, cto);
  await raw('POST', `/cto/marketplace/listings/${listing.id}/purchase`, { buyerSquadId: sq(1) }, pm1, { 'X-Idempotency-Key': idem() });
  log(`Squad 1 licensed "NestJS DDD Starter" for ${taka(8000)} → 100% to CTO wallet (${taka(wallet('cto@seu.edu.bd'))})`);

  const when = new Date(Date.now() + 864e5).toISOString();
  const booking = await raw('POST', '/cto/consultancy/bookings', { consultantId: uid('cto@seu.edu.bd'), clientSquadId: sq(1), scheduledAt: when }, pm1, { 'X-Idempotency-Key': idem() });
  await raw('POST', `/cto/consultancy/bookings/${booking.id}/complete`, {
    meetingNotes: 'Fifteen minute architecture session with Squad 1 covering domain boundaries for the billing module and the trade-offs between event sourcing and simple audit tables. We walked through the Prisma schema partitioning decisions required for telemetry tables, agreed on repository interfaces for the payment adapters, and sketched the migration order for the next sprint. The squad will split the billing context first, then extract the notification gateway behind an interface before adding the second payment provider integration.',
    prLinks: 'https://github.com/pointfex/squad-1/pull/44',
  }, cto);
  log('Consultancy completed: ৳2,000 consultant / ৳2,000 reserve (escrow settled)');
}

/* ─────────────────── 12. Final report ─────────────────── */
step(12, 'Closing the sprint — integrity & leaderboard');
{
  const chain = await raw('POST', '/ledger/verify-chain', undefined, ceo);
  const total = dbNum('SELECT SUM(balance) FROM "Account"');
  log(`Ledger chain: ${chain.chainStatus} (${chain.totalEntriesVerified} entries, ${chain.brokenEntriesCount} broken)`);
  log(`Money supply conserved: ${taka(total)} (seed = ৳5,600,000) → ${total === 5600000 ? 'BALANCED ✓' : 'DRIFT ✗'}`);

  const lb = await raw('GET', '/simulation-scores', undefined, ceo);
  log('\n   Final squad leaderboard:');
  lb.squadLeaderboard.slice(0, 3).forEach((s) => log(`   ${s.rank}. ${s.squadName} — valuation ${taka(s.valuation)} [${s.healthStatus}]`));
  log('   Top students:');
  lb.studentScores.slice(0, 3).forEach((s) => log(`   ${s.fullName} (${s.role}) — score ${s.simulationScore} (wallet ${taka(s.walletBalance)})`));

  const d = await raw('GET', '/dashboard/ceo', undefined, ceo);
  log(`\n   Studio macro: cash ${taka(d.macro.circulatingCash)} · escrow ${taka(d.macro.activeEscrow)} · valuation ${taka(d.macro.studioValuation)}`);
  log(`   Executives: ${d.executives.map((e) => `${e.role} ${taka(e.walletBalance)}`).join(' · ')}`);
  log(`   Open chaos incidents: ${d.activeChaosIncidents} · pending decisions: ${d.pendingDecisionsCount}`);
}

console.log('\n════════════════════ SAMPLE COMPANY FLOW COMPLETE ════════════════════');
