/* ============================================================================
 * Task Flow & Gate RBAC Verification
 *
 *   T1  assignee starts a TODO task                       -> 200, IN_PROGRESS
 *   T2  assignee flags complete with git proof            -> 200, FLAGGED_COMPLETE
 *   T3  CPO pm-verify is FORBIDDEN (PM gate: PM only)     -> 403
 *   T4  CTO pm-verify is FORBIDDEN                        -> 403
 *   T5  squad PM verifies                                 -> 200, PM_VERIFIED
 *   T6  CPO cto-verify is FORBIDDEN (CTO gate)            -> 403
 *   T7  PM cto-verify is FORBIDDEN                        -> 403
 *   T8  CTO verifies                                      -> 200, CTO_VERIFIED
 *   T9  CPO close is FORBIDDEN                            -> 403
 *   T10 squad PM closes                                   -> 200, CLOSED
 *   T11 assigning a BACKLOG task flips it to TODO         -> 200, TODO
 *   T12 unassigning a TODO task returns it to BACKLOG     -> 200, BACKLOG
 *   T13 CEO omnipotence: CEO can pm-verify another squad  -> 200 (on fresh task)
 *
 * Requires the docker compose stack (demo dataset).
 *   node scripts/test-task-flow.mjs
 * ==========================================================================*/
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '').replace(/\/api\/v1$/, '') + '/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0, failed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    failed++;
    failures.push(`${name} — ${e.message}`);
    console.log(`  FAIL  ${name}\n        ${e.message}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

async function login(email, password) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const r = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (r.ok) return (await r.json()).data.accessToken;
    if (r.status === 429) { await sleep(12_000); continue; } // throttle: 5 logins / 60s
    throw new Error(`login ${email} failed: ${r.status}`);
  }
  throw new Error(`login ${email} failed after retries`);
}
async function raw(token, method, path, body) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined || body === null ? undefined : JSON.stringify(body),
  });
}
async function expectStatus(token, method, path, body, code, label) {
  const r = await raw(token, method, path, body);
  let err = '';
  try { err = (await r.clone().json())?.error?.message || ''; } catch { /* no body */ }
  assert(r.status === code || (code === 200 && r.status === 201), `${label}: expected HTTP ${code}, got ${r.status}${err ? ` (${err})` : ''}`);
  return r;
}
async function statusOf(token, path, label) {
  const r = await raw(token, 'GET', path);
  assert(r.ok, `${label}: fetch failed ${r.status}`);
  return (await r.json()).data.status;
}

console.log('Task flow & gate RBAC verification');
console.log(`started ${new Date().toISOString()}\n`);

const DEMO_PW = process.env.SEED_DEMO_PASSWORD || 'Pointfex2026!';
const ceo = await login('noor@seu.edu.bd', process.env.CEO_PASSWORD || 'PointfexCeo2026!');
const cto = await login('cto@seu.edu.bd', DEMO_PW);
const cpo = await login('cpo@seu.edu.bd', DEMO_PW);
const pm1 = await login('pm1@seu.edu.bd', DEMO_PW);
const dev1 = await login('dev1_1@seu.edu.bd', DEMO_PW);

// discover squad 1 + members
const squadsRes = await (await fetch(`${BASE}/squads`, { headers: { Authorization: `Bearer ${ceo}` } })).json();
const squad = (squadsRes.data || squadsRes).find((s) => s.name === 'Squad 1');
assert(squad, 'demo Squad 1 must exist');
const squadDetail = await (await fetch(`${BASE}/squads/${squad.id}`, { headers: { Authorization: `Bearer ${ceo}` } })).json();
const dev = (squadDetail.data.members || squadDetail.members).find((m) => m.role === 'DEVELOPER');
assert(dev, 'Squad 1 must have a developer');

// create a dedicated task for this run
const created = await raw(pm1, 'POST', '/tasks', {
  squadId: squad.id,
  title: `Task-flow test ${Date.now()}`,
  description: 'ephemeral verification task',
  storyPoints: 3,
  priority: 'HIGH',
  assignedToId: dev.userId,
});
assert(created.status === 201, `create task failed: ${created.status}`);
const task = (await created.json()).data;
const path = `/tasks/${task.id}`;

console.log('--- happy path with gate RBAC ---');
await test('T1: assignee starts the task', async () => {
  const r = await expectStatus(dev1, 'POST', `${path}/start`, undefined, 200, 'T1');
  assert((await r.json()).data.status === 'IN_PROGRESS', 'status should be IN_PROGRESS');
});
await test('T2: assignee flags complete with git proof', async () => {
  const r = await expectStatus(dev1, 'POST', `${path}/flag-complete`, { gitPrUrl: 'https://github.com/pointfex/squad-1/pull/9' }, 200, 'T2');
  assert((await r.json()).data.status === 'FLAGGED_COMPLETE', 'status should be FLAGGED_COMPLETE');
});
await test('T3: CPO cannot pm-verify (PM gate)', () =>
  expectStatus(cpo, 'POST', `${path}/pm-verify`, { comment: 'x' }, 403, 'T3'));
await test('T4: CTO cannot pm-verify (PM gate)', () =>
  expectStatus(cto, 'POST', `${path}/pm-verify`, { comment: 'x' }, 403, 'T4'));
await test('T5: squad PM verifies', async () => {
  const r = await expectStatus(pm1, 'POST', `${path}/pm-verify`, { comment: 'criteria met' }, 200, 'T5');
  assert((await r.json()).data.status === 'PM_VERIFIED', 'status should be PM_VERIFIED');
});
await test('T6: CPO cannot cto-verify (CTO gate)', () =>
  expectStatus(cpo, 'POST', `${path}/cto-verify`, { critique: 'x' }, 403, 'T6'));
await test('T7: PM cannot cto-verify (CTO gate)', () =>
  expectStatus(pm1, 'POST', `${path}/cto-verify`, { critique: 'x' }, 403, 'T7'));
await test('T8: CTO verifies', async () => {
  const r = await expectStatus(cto, 'POST', `${path}/cto-verify`, { critique: 'clean' }, 200, 'T8');
  assert((await r.json()).data.status === 'CTO_VERIFIED', 'status should be CTO_VERIFIED');
});
await test('T9: CPO cannot close', () =>
  expectStatus(cpo, 'POST', `${path}/close`, undefined, 403, 'T9'));
await test('T10: squad PM closes', async () => {
  const r = await expectStatus(pm1, 'POST', `${path}/close`, undefined, 200, 'T10');
  assert((await r.json()).data.status === 'CLOSED', 'status should be CLOSED');
});

console.log('\n--- BACKLOG <-> TODO assignment flip ---');
const created2 = await raw(pm1, 'POST', '/tasks', {
  squadId: squad.id,
  title: `Backlog flip test ${Date.now()}`,
  storyPoints: 2,
}); // no assignee -> BACKLOG
assert(created2.status === 201, `create backlog task failed: ${created2.status}`);
const task2 = (await created2.json()).data;
const path2 = `/tasks/${task2.id}`;

await test('T11: assigning a BACKLOG task flips it to TODO', async () => {
  assert(task2.status === 'BACKLOG', 'fresh task should be BACKLOG');
  await expectStatus(pm1, 'PATCH', path2, { assignedToId: dev.userId }, 200, 'T11');
  const st = await statusOf(pm1, path2, 'T11');
  assert(st === 'TODO', `expected TODO after assignment, got ${st}`);
});
await test('T12: unassigning returns it to BACKLOG', async () => {
  await expectStatus(pm1, 'PATCH', path2, { assignedToId: null }, 200, 'T12');
  const st = await statusOf(pm1, path2, 'T12');
  assert(st === 'BACKLOG', `expected BACKLOG after unassignment, got ${st}`);
});

console.log('\n--- CEO omnipotence at the gates ---');
const created3 = await raw(ceo, 'POST', '/tasks', {
  squadId: squad.id,
  title: `CEO gate test ${Date.now()}`,
  storyPoints: 1,
  assignedToId: dev.userId,
});
const task3 = (await created3.json()).data;
const path3 = `/tasks/${task3.id}`;
await test('T13: CEO can drive a task through both gates', async () => {
  await expectStatus(ceo, 'POST', `${path3}/start`, undefined, 200, 'T13-start');
  await expectStatus(dev1, 'POST', `${path3}/flag-complete`, { gitCommitHash: 'abc1234' }, 200, 'T13-flag');
  await expectStatus(ceo, 'POST', `${path3}/pm-verify`, { comment: 'ceo override' }, 200, 'T13-pm');
  await expectStatus(ceo, 'POST', `${path3}/cto-verify`, { critique: 'ceo override' }, 200, 'T13-cto');
  const st = await statusOf(ceo, path3, 'T13');
  assert(st === 'CTO_VERIFIED', `expected CTO_VERIFIED, got ${st}`);
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed / ${passed + failed} total`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log('ALL TASK FLOW CHECKS PASSED');
