/* Financial-scope checks. Safe: these tests do not post or mutate money. */
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '').replace(/\/api\/v1$/, '') + '/api/v1';
const MEMBER_PW = process.env.SEED_DEMO_PASSWORD || 'Pointfex2026!';
const CEO_PW = process.env.CEO_PASSWORD || 'PointfexCeo2026!';
const assert = (ok, message) => { if (!ok) throw new Error(message); };
async function login(email, password) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (response.ok) return (await response.json()).data.accessToken;
    if (response.status === 429 && attempt < 2) { await new Promise((resolve) => setTimeout(resolve, 62_000)); continue; }
    throw new Error(`login ${email} failed: ${response.status}`);
  }
  throw new Error(`login ${email} failed after retries`);
}
async function get(token, path) {
  const response = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return json.data;
}
async function post(token, path) {
  return fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
}
async function denied(token, path, method = 'POST') {
  const response = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  assert(response.status === 403, `${method} ${path} should be 403, got ${response.status}`);
}

const [ceo, cfo, pm, dev] = await Promise.all([
  login('noor@seu.edu.bd', CEO_PW), login('cfo@seu.edu.bd', MEMBER_PW),
  login('pm1@seu.edu.bd', MEMBER_PW), login('dev1_1@seu.edu.bd', MEMBER_PW),
]);
const [ceoAccounts, cfoAccounts, pmAccounts, devAccounts] = await Promise.all([
  get(ceo, '/ledger/accounts'), get(cfo, '/ledger/accounts'), get(pm, '/ledger/accounts'), get(dev, '/ledger/accounts'),
]);
const cfoOverview = await get(cfo, '/dashboard/cfo');
assert(Number.isFinite(cfoOverview.cashInCirculation), 'CFO overview exposes cash in circulation');
assert(Number.isFinite(cfoOverview.outstandingLoanPrincipal) && Number.isFinite(cfoOverview.totalInvested), 'CFO overview exposes loan and investment totals');
const recalc = await post(cfo, '/dashboard/cfo/recalculate-valuations');
assert(recalc.ok && Number((await recalc.json()).data.recalculated) >= 0, 'CFO can explicitly recalculate all active squad valuations');
assert(ceoAccounts.some((a) => a.type === 'SYSTEM_RESERVE'), 'CEO sees the system reserve');
assert(cfoAccounts.some((a) => a.type === 'SYSTEM_RESERVE'), 'CFO sees the system reserve');
assert(!pmAccounts.some((a) => a.type === 'SYSTEM_RESERVE'), 'PM cannot see the system reserve');
assert(!devAccounts.some((a) => a.type === 'SQUAD_TREASURY' || a.type === 'SYSTEM_RESERVE'), 'Developer sees only personal wallet');
assert(devAccounts.length === 1 && devAccounts[0].ownerId, 'Developer sees their one personal wallet');
assert(pmAccounts.some((a) => a.type === 'PERSONAL_WALLET' && a.ownerId), 'PM sees own wallet');
assert(pmAccounts.some((a) => a.type === 'SQUAD_TREASURY' && a.squadId), 'PM sees own squad treasury');
await denied(cfo, '/ledger/pool-funding/direct');
await denied(pm, '/ledger/allocate');
await denied(dev, '/ledger/allocate');
console.log('PASS: CEO/CFO global scope; PM squad+own scope; developer personal-only scope; unauthorized funding writes denied.');
