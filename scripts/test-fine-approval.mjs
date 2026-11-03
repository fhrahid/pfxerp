/* Local integration test; posts BDT 0.02 total to reserve after CFO approval. */
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(BASE)) throw new Error('Refusing to run against a non-local API');
const memberPassword = process.env.SEED_DEMO_PASSWORD || 'Pointfex2026!';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function login(email, password) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (r.ok) return (await r.json()).data.accessToken;
    if (r.status === 429 && i < 2) { await sleep(62_000); continue; }
    throw new Error(`Login failed (${email}): ${r.status}`);
  }
  throw new Error('Login failed after retries');
}
async function request(token, method, path, body) {
  return fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
}
function assert(ok, message) { if (!ok) throw new Error(message); }
const [cpo, cto, cfo, ceo] = await Promise.all([
  login('cpo@seu.edu.bd', memberPassword), login('cto@seu.edu.bd', memberPassword),
  login('cfo@seu.edu.bd', memberPassword), login('noor@seu.edu.bd', process.env.CEO_PASSWORD || 'PointfexCeo2026!'),
]);
const squads = await (await request(ceo, 'GET', '/squads')).json();
const squad = squads.data.find((s) => s.isActive !== false);
const users = await (await request(ceo, 'GET', '/users')).json();
const dev = users.data.find((u) => u.role === 'DEVELOPER');
assert(squad && dev, 'Scratch/demo squad and developer are required');
// Seed one cent in the local test recipient wallet, then the CFO-approved fine
// transfers it back to reserve. Net balances are unchanged after this suite.
const accounts = await (await request(ceo, 'GET', '/ledger/accounts')).json();
const devWallet = accounts.data.find((a) => a.type === 'PERSONAL_WALLET' && a.ownerId === dev.id);
assert(devWallet, 'Developer wallet missing');
const localFund = await request(ceo, 'POST', `/accounts/${devWallet.id}/bonus?idempotencyKey=local-fine-test-${Date.now()}`, { amount: 0.01, reason: 'Local fine approval test seed' });
assert(localFund.ok, `Local test wallet funding failed: ${localFund.status}`);

const proposalA = await request(cpo, 'POST', '/fines/proposals', { targetType: 'SQUAD', targetSquadId: squad.id, amount: 0.01, reason: 'Local fine approval workflow test' });
assert(proposalA.ok, `CPO squad proposal failed: ${proposalA.status} ${await proposalA.clone().text()}`);
const fineA = (await proposalA.json()).data;
const proposalB = await request(cto, 'POST', '/fines/proposals', { targetType: 'USER', targetUserId: dev.id, amount: 0.01, reason: 'Local fine target user workflow test' });
assert(proposalB.ok, `CTO user proposal failed: ${proposalB.status} ${await proposalB.clone().text()}`);
const fineB = (await proposalB.json()).data;
const rejected = await request(cpo, 'POST', `/fines/proposals/${fineA.id}/approve`);
assert(rejected.status === 403, `CPO approval must be denied, got ${rejected.status}`);
for (const fine of [fineA, fineB]) {
  const approved = await request(cfo, 'POST', `/fines/proposals/${fine.id}/approve`);
  assert(approved.ok, `CFO approval failed: ${approved.status} ${await approved.clone().text()}`);
}
const replay = await request(cfo, 'POST', `/fines/proposals/${fineA.id}/approve`);
assert(!replay.ok, 'A second approval must not debit a fine twice');
console.log('PASS: CPO squad fine + CTO individual fine proposals; non-CFO approval denied; CFO posts ledgered fines; double approval rejected. Local BDT 0.01 wallet test seed is fined back to reserve.');
