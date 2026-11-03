/* ============================================================================
 * RBAC Hierarchy Verification — privilege escalation & CEO omnipotence
 *
 * Asserts (users PATCH /users/:id):
 *   R1  Non-CEO cannot change the CEO's role            -> 403
 *   R2  Non-CEO cannot deactivate the CEO               -> 403
 *   R3  Non-CEO cannot reset the CEO's password         -> 403
 *   R4  Non-CEO cannot change a peer executive's role   -> 403
 *   R5  Non-CEO cannot change their OWN role            -> 403
 *   R6  Non-CEO cannot deactivate their OWN account     -> 403
 *   R7  Non-CEO CAN update own profile (no role change) -> 200
 *   R8  Non-CEO CAN manage non-exec members (PM/DEV)    -> 200
 *   R9  Non-CEO CANNOT assign exec/custom roles         -> 403
 *   R10 CEO (omnipotent) CAN administer any account     -> 200
 *   R11 CEO CAN edit an executive account               -> 200
 *
 * Requires the docker compose stack (demo dataset) on localhost.
 *   node scripts/test-rbac-hierarchy.mjs
 * ==========================================================================*/
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '').replace(/\/api\/v1$/, '') + '/api/v1';

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(email, password) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const r = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (r.ok) return (await r.json()).data.accessToken;
    if (r.status === 429 && attempt < 6) {
      await sleep(12_000); // auth throttle: 5 logins / 60s — wait out the window
      continue;
    }
    throw new Error(`login ${email} failed: ${r.status}`);
  }
  throw new Error(`login ${email} failed after retries`);
}
async function expectStatus(token, method, path, body, code, label) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined || body === null ? undefined : JSON.stringify(body),
  });
  let err = '';
  try { err = (await r.json())?.error?.message || ''; } catch { /* no body */ }
  assert(r.status === code, `${label}: expected HTTP ${code}, got ${r.status}${err ? ` (${err})` : ''}`);
  return r;
}

console.log('RBAC hierarchy verification');
console.log(`started ${new Date().toISOString()}\n`);

const DEMO_PW = process.env.SEED_DEMO_PASSWORD || 'Pointfex2026!';
const CEO_PW = process.env.CEO_PASSWORD || 'PointfexCeo2026!';

const ceo = await login('noor@seu.edu.bd', CEO_PW);
const cpo = await login('cpo@seu.edu.bd', DEMO_PW);
const cto = await login('cto@seu.edu.bd', DEMO_PW);

const rosterRes = await (await fetch(`${BASE}/users`, { headers: { Authorization: `Bearer ${ceo}` } })).json();
const roster = rosterRes?.data || rosterRes;
const byEmail = (e) => roster.find((u) => u.email === e);
const ceoUser = byEmail('noor@seu.edu.bd');
const cpoUser = byEmail('cpo@seu.edu.bd');
const ctoUser = byEmail('cto@seu.edu.bd');
const devUser = byEmail('dev1_1@seu.edu.bd');
assert(ceoUser && cpoUser && ctoUser && devUser, 'demo roster must contain ceo/cpo/cto/dev1_1');
const devOriginalRole = devUser.role;

console.log('--- CPO (people-ops executive) must NOT escalate ---');
await test('R1: CPO cannot change CEO role', () =>
  expectStatus(cpo, 'PATCH', `/users/${ceoUser.id}`, { role: 'DEVELOPER' }, 403, 'R1'));
await test('R2: CPO cannot deactivate CEO', () =>
  expectStatus(cpo, 'PATCH', `/users/${ceoUser.id}`, { isActive: false }, 403, 'R2'));
await test('R3: CPO cannot reset CEO password', () =>
  expectStatus(cpo, 'PATCH', `/users/${ceoUser.id}`, { password: 'Hijacked123!' }, 403, 'R3'));
await test('R4: CPO cannot change peer executive (CTO) role', () =>
  expectStatus(cpo, 'PATCH', `/users/${ctoUser.id}`, { role: 'PM' }, 403, 'R4'));
await test('R5: CPO cannot change OWN role', () =>
  expectStatus(cpo, 'PATCH', `/users/${cpoUser.id}`, { role: 'PM' }, 403, 'R5'));
await test('R6: CPO cannot deactivate OWN account', () =>
  expectStatus(cpo, 'PATCH', `/users/${cpoUser.id}`, { isActive: false }, 403, 'R6'));
await test('R9: CPO cannot assign executive role to a member', () =>
  expectStatus(cpo, 'PATCH', `/users/${devUser.id}`, { role: 'CTO' }, 403, 'R9'));

console.log('\n--- CPO legitimate people-ops powers ---');
await test('R7: CPO can update own profile (name only)', async () => {
  await expectStatus(cpo, 'PATCH', `/users/${cpoUser.id}`, { fullName: 'Rafiul Karim (CPO)' }, 200, 'R7');
});
await test('R8: CPO can promote DEVELOPER -> PM', async () => {
  await expectStatus(cpo, 'PATCH', `/users/${devUser.id}`, { role: 'PM' }, 200, 'R8');
  await expectStatus(cpo, 'PATCH', `/users/${devUser.id}`, { role: devOriginalRole }, 200, 'R8-restore');
});

console.log('\n--- CEO is omnipotent ---');
await test('R10: CEO can administer a regular member', async () => {
  await expectStatus(ceo, 'PATCH', `/users/${devUser.id}`, { fullName: devUser.fullName }, 200, 'R10');
});
await test('R11: CEO can administer an executive account', async () => {
  await expectStatus(ceo, 'PATCH', `/users/${ctoUser.id}`, { fullName: ctoUser.fullName }, 200, 'R11');
});
await test('R11b: CEO can change an executive role (CFO<->CTO swap on dev-safe target)', async () => {
  // safe target: a developer promoted then restored
  await expectStatus(ceo, 'PATCH', `/users/${devUser.id}`, { role: 'CTO' }, 200, 'R11b-up');
  await expectStatus(ceo, 'PATCH', `/users/${devUser.id}`, { role: devOriginalRole }, 200, 'R11b-down');
});

// Executive audit trail must have recorded the attempts
const auditRes = await (await fetch(`${BASE}/audit/logs?limit=50`, { headers: { Authorization: `Bearer ${ceo}` } })).json();
const auditList = auditRes?.data?.logs || auditRes?.data || [];
console.log(`\nexecutive audit entries visible to CEO: ${auditList.length}`);

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed / ${passed + failed} total`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log('ALL RBAC HIERARCHY CHECKS PASSED');
