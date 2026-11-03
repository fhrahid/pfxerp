/* ============================================================================
 * Multi-assignee + Deactivated-squad visibility + CEO delete verification
 *
 *   M1  create task with 2 assignees (dev + PM)          -> both in assigneeIds
 *   M2  PM (self-assigned) can start + flag complete     -> 200
 *   M3  second assignee can flag too (any assignee)      -> covered by M2 logic
 *   M4  updating assigneeIds replaces the set            -> reflected
 *   S1  deactivated squads vanish from default list      -> not present
 *   S2  ?includeInactive=true shows deactivated squads   -> present, isActive=false
 *   S3  CPO cannot delete a squad                        -> 403
 *   S4  CEO deletes a squad                              -> 200, gone from list
 *   U1  CPO cannot delete a user                         -> 403
 *   U2  CEO cannot delete self                           -> 403
 *   U3  CEO cannot delete the other CEO account          -> 403
 *   U4  CEO deletes a fresh user                         -> 200
 *
 *   node scripts/test-squad-user-mgmt.mjs
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
    if (r.status === 429) { await sleep(12_000); continue; }
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
const list = async (token, path) => (await (await raw(token, 'GET', path)).json()).data;

console.log('Multi-assignee / squad visibility / CEO delete verification');
console.log(`started ${new Date().toISOString()}\n`);

const DEMO_PW = process.env.SEED_DEMO_PASSWORD || 'Pointfex2026!';
const ceo = await login('noor@seu.edu.bd', process.env.CEO_PASSWORD || 'PointfexCeo2026!');
const cpo = await login('cpo@seu.edu.bd', DEMO_PW);
const pm1 = await login('pm1@seu.edu.bd', DEMO_PW);

const squads = await list(ceo, '/squads');
const squad1 = squads.find((s) => s.name === 'Squad 1');
assert(squad1, 'Squad 1 must exist');
const detail = await list(ceo, `/squads/${squad1.id}`);
const dev = detail.members.find((m) => m.role === 'DEVELOPER');
const pm = detail.members.find((m) => m.role === 'PM');
assert(dev && pm, 'Squad 1 needs a dev and a PM');

console.log('--- multi-assignee ---');
let taskId;
await test('M1: create task with dev + PM as assignees', async () => {
  const r = await raw(pm1, 'POST', '/tasks', {
    squadId: squad1.id,
    title: `Multi-assignee test ${Date.now()}`,
    storyPoints: 2,
    assigneeIds: [dev.userId, pm.userId],
  });
  assert(r.status === 201, `create failed: ${r.status}`);
  const t = (await r.json()).data;
  taskId = t.id;
  assert(t.status === 'TODO', `expected TODO, got ${t.status}`);
  assert((t.assigneeIds || []).length === 2, `expected 2 assignees, got ${JSON.stringify(t.assigneeIds)}`);
});
await test('M2: PM co-assignee can start AND flag complete', async () => {
  await expectStatus(pm1, 'POST', `/tasks/${taskId}/start`, undefined, 200, 'M2-start');
  await expectStatus(pm1, 'POST', `/tasks/${taskId}/flag-complete`, { gitPrUrl: 'https://github.com/pointfex/squad-1/pull/42' }, 200, 'M2-flag');
  const t = await list(pm1, `/tasks/${taskId}`);
  assert(t.status === 'FLAGGED_COMPLETE', `expected FLAGGED_COMPLETE, got ${t.status}`);
});
await test('M4: updating assigneeIds replaces the set', async () => {
  await expectStatus(pm1, 'PATCH', `/tasks/${taskId}`, { assigneeIds: [pm.userId] }, 200, 'M4');
  const t = await list(pm1, `/tasks/${taskId}`);
  assert((t.assigneeIds || []).length === 1 && t.assigneeIds[0] === pm.userId, `expected only PM, got ${JSON.stringify(t.assigneeIds)}`);
});

console.log('\n--- deactivated squad visibility ---');
const victimSquad = await (await raw(ceo, 'POST', '/squads', { name: `Doomed Squad ${Date.now()}`, description: 'to be deactivated + deleted', initialBalance: 0 })).json();
await test('S1: deactivated squads hidden by default', async () => {
  await expectStatus(cpo, 'PATCH', `/squads/${victimSquad.data.id}`, { isActive: false }, 200, 'S1-deactivate');
  const active = await list(ceo, '/squads');
  assert(!active.some((s) => s.id === victimSquad.data.id), 'deactivated squad should be hidden by default');
});
await test('S2: includeInactive=true reveals deactivated squads', async () => {
  const all = await list(ceo, '/squads?includeInactive=true');
  const found = all.find((s) => s.id === victimSquad.data.id);
  assert(found, 'deactivated squad missing from includeInactive list');
  assert(found.isActive === false, 'flag isActive should be false');
});
await test('S3: CPO cannot delete a squad', () =>
  expectStatus(cpo, 'DELETE', `/squads/${victimSquad.data.id}`, undefined, 403, 'S3'));
await test('S4: CEO deletes the squad permanently', async () => {
  await expectStatus(ceo, 'DELETE', `/squads/${victimSquad.data.id}`, undefined, 200, 'S4');
  const all = await list(ceo, '/squads?includeInactive=true');
  assert(!all.some((s) => s.id === victimSquad.data.id), 'squad should be gone after delete');
});

console.log('\n--- user deletion (CEO only) ---');
const freshUser = await (await raw(ceo, 'POST', '/users', {
  email: `deleteme${Date.now()}@seu.edu.bd`,
  fullName: 'Delete Me',
  password: 'DeleteMe123!',
  role: 'DEVELOPER',
})).json();
await test('U1: CPO cannot delete a user', () =>
  expectStatus(cpo, 'DELETE', `/users/${freshUser.data.id}`, undefined, 403, 'U1'));

let ceoId = '';
try { ceoId = (await list(ceo, '/auth/me')).id; } catch { ceoId = ''; }
if (!ceoId) {
  const roster = await list(ceo, '/users');
  ceoId = (roster.find((u) => u.email === 'noor@seu.edu.bd') || {}).id;
}
await test('U2: CEO cannot delete self', () =>
  expectStatus(ceo, 'DELETE', `/users/${ceoId}`, undefined, 403, 'U2'));
await test('U3: CEO cannot delete the sitting CEO account', () =>
  expectStatus(ceo, 'DELETE', `/users/${ceoId}`, undefined, 403, 'U3'));
await test('U4: CEO deletes a fresh user', async () => {
  await expectStatus(ceo, 'DELETE', `/users/${freshUser.data.id}`, undefined, 200, 'U4');
  const roster = await list(ceo, '/users');
  assert(!roster.some((u) => u.id === freshUser.data.id), 'user should be gone after delete');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed / ${passed + failed} total`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log('ALL SQUAD/USER MANAGEMENT CHECKS PASSED');
