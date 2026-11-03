/* Opt-in local-only integration test. It posts BDT 0.01 to the local CEO wallet. */
if (process.env.ALLOW_LEDGER_TEST_MUTATION !== 'true') {
  throw new Error('Set ALLOW_LEDGER_TEST_MUTATION=true to permit the local test transaction');
}
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000/api/v1';
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(BASE)) throw new Error('Refusing to run against a non-local API');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function login() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'noor@seu.edu.bd', password: process.env.CEO_PASSWORD || 'PointfexCeo2026!' }) });
    if (r.ok) return (await r.json()).data.accessToken;
    if (r.status === 429 && attempt < 2) { await sleep(62_000); continue; }
    throw new Error(`CEO login failed: ${r.status}`);
  }
  throw new Error('CEO login failed');
}
const token = await login();
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const me = await (await fetch(`${BASE}/auth/me`, { headers })).json();
const wallet = await fetch(`${BASE}/ledger/accounts` , { headers }).then((r) => r.json());
const account = (wallet.data || []).find((a) => a.type === 'PERSONAL_WALLET' && a.ownerId === me.data.id);
if (!account) throw new Error('CEO personal wallet missing');
const key = `local-ledger-test-${Date.now()}`;
const endpoint = `${BASE}/accounts/${account.id}/bonus?idempotencyKey=${key}`;
const body = JSON.stringify({ amount: 0.01, reason: 'Local ledger integrity test' });
const first = await fetch(endpoint, { method: 'POST', headers, body });
if (!first.ok) throw new Error(`First local post failed: ${first.status} ${await first.text()}`);
const firstData = (await first.json()).data;
const replay = await fetch(endpoint, { method: 'POST', headers, body });
if (!replay.ok) throw new Error(`Idempotent replay failed: ${replay.status} ${await replay.text()}`);
const replayData = (await replay.json()).data;
if (firstData.transactionId !== replayData.transactionId) throw new Error('Idempotent retry created a second transaction');
const chain = await fetch(`${BASE}/ledger/verify-chain`, { method: 'POST', headers }).then((r) => r.json());
if (chain.data?.brokenEntriesCount !== 0) throw new Error(`Ledger chain invalid: ${JSON.stringify(chain.data)}`);
console.log(`PASS: advisory-locked ledger post, idempotent replay, HMAC chain valid (${chain.data.totalEntriesVerified} entries). Local CEO wallet credited BDT 0.01.`);
