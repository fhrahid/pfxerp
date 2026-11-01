/* Headless smoke test for the frontend: stubs document/localStorage/fetch/crypto,
   loads app.js as a browser would, then walks login -> every tab -> key interactions. */
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('public/app.js', 'utf8');

/* ---------- stubs ---------- */
const elements = new Map();
function makeEl(id) {
  return {
    id,
    _html: '',
    set innerHTML(v) { this._html = String(v); },
    get innerHTML() { return this._html; },
    textContent: '',
    style: {},
    value: '',
    checked: false,
    children: [],
    classList: { add() {}, remove() {} },
    appendChild() {}, remove() {},
    setAttribute() {}, addEventListener() {},
    querySelectorAll: () => [],
    querySelector: () => null,
    submit: () => {},
    onsubmit: null, oninput: null,
  };
}
function getEl(id) {
  if (!elements.has(id)) elements.set(id, makeEl(id));
  return elements.get(id);
}

const listeners = {};
const documentStub = {
  getElementById: getEl,
  createElement: () => makeEl('tmp'),
  querySelectorAll: () => [],
};

/* canned API data */
const ceoUser = {
  id: 'u-ceo', email: 'noor@seu.edu.bd', fullName: 'Asaduzzaman Noor', role: 'CEO', tier: null,
  walletBalance: 0,
  squadMemberships: [],
};
const squads = [1, 2, 3, 4, 5, 6].map((i) => ({
  id: 'sq' + i, name: 'Squad ' + i, description: '', healthStatus: 'BULLISH', valuation: 100000,
  balance: 100000, memberCount: 5, taskCount: 2,
}));
const squadDetail = (id) => ({
  id, name: 'Squad ' + id.slice(2), balance: 100000, valuation: 100000, healthStatus: 'BULLISH',
  members: [
    { membershipId: 'm1', userId: 'u-pm', fullName: 'PM One', role: 'PM', tier: 'TIER_A', allocation: 1 },
    { membershipId: 'm2', userId: 'u-dev', fullName: 'Dev One', role: 'DEVELOPER', tier: 'TIER_B', allocation: 1 },
  ],
});
const tasks = [
  { id: 't1', title: 'Auth flow', status: 'TODO', storyPoints: 5, priority: 'HIGH', squadId: 'sq1', assignedTo: { fullName: 'Dev One' }, squad: { id: 'sq1', name: 'Squad 1' }, auditEvents: [] },
  { id: 't2', title: 'CRUD views', status: 'IN_PROGRESS', storyPoints: 3, priority: 'MEDIUM', squadId: 'sq1', assignedTo: { fullName: 'Dev One' }, squad: { id: 'sq1', name: 'Squad 1' }, auditEvents: [] },
];
const responses = {
  'GET /auth/me': ceoUser,
  'GET /dashboard/me': { walletBalance: 3500, openTasks: 2, latestDpi: 88, squads },
  'GET /squads': squads,
  'GET /squads/sq1': squadDetail('sq1'),
  'GET /tasks?squadId=sq1': tasks,
  'GET /tasks/t1': { ...tasks[0], assignedToId: 'u-dev' },
  'GET /payroll?status=SUBMITTED': [{ id: 'p1', squadId: 'sq1', squad: { name: 'Squad 1' }, labNumber: 1, totalProposed: 5500, status: 'SUBMITTED', lineItems: [{ user: { fullName: 'Dev One' }, tier: 'REGULAR', amount: 2000 }] }],
  'GET /payroll': [],
  'GET /sprint-payouts': [{ id: 'sp1', sprintNumber: 1, status: 'PROPOSED', totalPool: 150000, items: [] }],
  'GET /loans': [{ id: 'l1', borrowerSquad: { name: 'Squad 4' }, principalAmount: 20000, totalDue: 23000, status: 'ACTIVE', disbursedAt: null }],
  'GET /equity': { stakes: [{ squad: { name: 'Squad 2' }, stakePercent: 0.1, investedAmount: 15000, sprintNumber: 1, isActive: true }], dividendsReceived: 500 },
  'GET /ledger/transactions?limit=15': [{ id: 'tx1', createdAt: new Date().toISOString(), referenceType: 'PAYROLL', description: 'payroll', entries: [{ direction: 'DEBIT', amount: 5500 }] }],
  'GET /governance/decisions': [{ id: 'd1', title: 'Loan Squad 4', description: 'approve', category: 'LOAN_APPROVAL', status: 'PROPOSED', proposedById: 'u-cfo', votes: [{ voter: { role: 'CTO', fullName: 'Nafisa' }, vote: 'APPROVE', voterId: 'u-cto' }] }],
  'GET /bounty/targets': [{ id: 'bt1', title: 'Squad1 target', targetSquadName: 'Squad 1', totalBountyPool: 10000, remainingPool: 5000, openBugCount: 1, isActive: true, targetSquadId: 'sq1' }],
  'GET /bounty/reports': [{ id: 'r1', title: 'SQLi', severity: 'CRITICAL', status: 'SUBMITTED', reportingUser: { fullName: 'Dev Two' }, reportingSquad: { name: 'Squad 2' }, bountyAmount: null, targetSquadId: 'sq1' }],
  'GET /cto/citations?limit=10': { items: [{ squad: { name: 'Squad 3' }, type: 'CODE_SMELL', fineAmount: 2000, createdAt: new Date().toISOString() }], total: 1 },
  'GET /cto/certifications/queue': { pendingCount: 1, queue: [{ id: 'c1', applicantName: 'Dev One', certificationType: 'CONSULTANT', portfolioUrl: '', applicationNotes: '' }] },
  'GET /cto/certifications/me': [],
  'GET /cto/marketplace/listings': [{ id: 'ml1', title: 'Starter kit', authorName: 'CTO', price: 6000, purchaseCount: 2, isCtoVerified: true }],
  'GET /cto/consultancy/bookings': [{ id: 'cb1', consultantId: 'u-cto', consultant: { fullName: 'Nafisa' }, clientSquad: { name: 'Squad 1' }, scheduledAt: new Date().toISOString(), status: 'SCHEDULED' }],
  'GET /cto/certifications/consultants': [{ id: 'u-cto', fullName: 'Nafisa Ahmed', role: 'CTO' }],
  'GET /clients': [{ id: 'cl1', companyName: 'Acme', contactEmail: 'a@b.c', contracts: [] }],
  'GET /clients/contracts': [{ id: 'ct1', title: 'POS Platform', status: 'ACTIVE', client: { companyName: 'Acme' }, totalValue: 200000, escrowBalance: 80000, milestones: [{ id: 'ms1', milestoneName: 'MVP', assignedSquad: { name: 'Squad 1' }, payoutAmount: 80000, status: 'CLIENT_REVIEW' }] }],
  'GET /notices': [{ id: 'n1', title: 'Citation', category: 'DISCIPLINARY', status: 'DISPATCHED', sender: { fullName: 'CPO' }, createdAt: new Date().toISOString(), encryptedContent: b64('test notice') }],
  'GET /chaos/events?includeResolved=true': [{ id: 'ch1', type: 'SERVER_OUTAGE', title: 'DB fail', description: 'x', targetSquad: { name: 'Squad 4' }, penaltyAmount: 5000, resolvedAt: null, createdAt: new Date().toISOString() }],
  'GET /simulation-scores': { squadLeaderboard: [{ rank: 1, squadId: 'sq1', squadName: 'Squad 1', valuation: 280000, healthStatus: 'BULLISH' }], studentScores: [{ userId: 'u1', fullName: 'Dev One', role: 'DEVELOPER', walletBalance: 3500, squadValuation: 280000, simulationScore: 94.5 }] },
  'GET /users': [ceoUser, { id: 'u2', fullName: 'Dev One', role: 'DEVELOPER', tier: 'TIER_B', email: 'd@x.dev', squadMemberships: [] }],
  'GET /settings': [{ key: 'WEEKLY_LAB_BUDGET', value: '10000', type: 'NUMBER' }],
};

let fetchLog = [];
async function fetchStub(url, opts = {}) {
  const method = opts.method || 'GET';
  const path = url.replace('/api/v1', '');
  const key = method + ' ' + path.split('?')[0] + (path.includes('?') ? '?' + path.split('?')[1] : '');
  fetchLog.push(key);
  if (method === 'POST' && path === '/auth/login') {
    return jsonRes({ data: { accessToken: 'tok', refreshToken: 'ref', user: ceoUser } });
  }
  const hit = responses[key] ?? responses['GET ' + path.split('?')[0] + (path.includes('?') ? path.slice(path.indexOf('?')) : '')];
  if (hit !== undefined) return jsonRes({ data: hit });
  // default empty per method
  if (method === 'GET') return jsonRes({ data: [] });
  return jsonRes({ data: { ok: true } });
}
function jsonRes(obj) {
  return { ok: true, status: 200, json: async () => obj };
}
function b64(s) { return Buffer.from(s).toString('base64'); }

const storage = new Map();
const sandbox = {
  console,
  document: documentStub,
  localStorage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) },
  fetch: fetchStub,
  crypto: { randomUUID: () => 'uuid-' + Math.random() },
  FormData: class { constructor(f) { this._f = f; } get(n) { const el = this._f?.elements?.[n]; return el ? el.value : ''; } entries() { return [][Symbol.iterator](); } },
  setTimeout, clearTimeout,
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  event: { preventDefault() {}, target: null },
};
sandbox.window = sandbox;
vm.createContext(sandbox);

/* ---------- run ---------- */
const failures = [];
function check(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else { console.log('  FAIL ' + name); failures.push(name); }
}

(async () => {
  console.log('--- loading app.js (login screen) ---');
  vm.runInContext(code, sandbox, { filename: 'app.js' });
  await new Promise((r) => setTimeout(r, 50));
  check('login screen rendered', getEl('app').innerHTML.includes('POINT'));

  console.log('--- simulating login (CEO) ---');
  await sandbox.doLoginDirect ? null : null;
  // call internal login via fetch stubbing: set tokens then boot
  vm.runInContext(`
    S.token='tok'; S.refreshToken='ref'; saveSession(); boot();
  `, sandbox);
  await new Promise((r) => setTimeout(r, 150));
  check('sidebar rendered', getEl('app').innerHTML.includes('sidebar'));
  check('overview rendered', getEl('content').innerHTML.includes('My Wallet'));

  const tabs = ['kanban', 'squads', 'roster', 'payroll', 'finance', 'governance', 'marketplace', 'consultancy', 'quality', 'bounty', 'clients', 'notices', 'chaos', 'leaderboard', 'settings'];
  for (const t of tabs) {
    try {
      vm.runInContext(`setTab('${t}')`, sandbox);
      await new Promise((r) => setTimeout(r, 80));
      const html = getEl('content').innerHTML;
      check('tab ' + t + ' rendered (' + html.length + ' chars)', html.length > 50);
    } catch (e) {
      check('tab ' + t + ' rendered', false);
      console.log('      error: ' + e.message);
    }
  }

  console.log('--- modal flows ---');
  try {
    vm.runInContext("uiTaskDetail('t1')", sandbox);
    await new Promise((r) => setTimeout(r, 80));
    check('task detail modal', getEl('modal-root').innerHTML.includes('Audit trail'));
    vm.runInContext('closeModal()', sandbox);
  } catch (e) { check('task detail modal', false); console.log('      ' + e.message); }

  try {
    vm.runInContext("formModal('Test', [{name:'a',label:'A',type:'text',value:'x'}], 'OK', async()=>{})", sandbox);
    check('formModal opens', getEl('modal-root').innerHTML.includes('mform'));
    vm.runInContext('closeModal()', sandbox);
  } catch (e) { check('formModal opens', false); console.log('      ' + e.message); }

  try { vm.runInContext('toast("hello")', sandbox); check('toast works', true); } catch (e) { check('toast works', false); }

  console.log(failures.length ? `\nFAILURES: ${failures.length}` : '\nALL FRONTEND CHECKS PASSED');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error('harness error:', e); process.exit(1); });
