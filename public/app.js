/* Pointfex ERP — web console (vanilla JS, no build step) */
'use strict';

const API = '/api/v1';
const S = { token: null, refreshToken: null, user: null, tab: 'overview', squads: [], kanbanSquad: null };

const EXEC = ['CEO', 'CFO', 'CTO', 'CPO'];
const isExec = () => EXEC.includes(S.user?.role);
const isCEO = () => S.user?.role === 'CEO';
const isCFO = () => S.user?.role === 'CFO';
const isCTO = () => S.user?.role === 'CTO';
const isCPO = () => S.user?.role === 'CPO';
const isPM = () => S.user?.role === 'PM';
const isDev = () => S.user?.role === 'DEVELOPER';
const canManage = () => isCPO() || isCEO();
const mySquads = () => (S.user?.squadMemberships || []).map((m) => m.squad).filter(Boolean);

/* ============================== helpers ============================== */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '৳' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const dt = (d) => (d ? new Date(d).toLocaleString() : '—');

function toast(msg, ok = true) {
  const el = document.createElement('div');
  el.className = 'toast ' + (ok ? 'ok' : 'err');
  el.textContent = msg;
  document.getElementById('toast-root').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

async function rawApi(method, path, body, headers) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}), ...(headers || {}) },
    body: body === undefined || body === null ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error(json?.error?.message || json?.message || res.statusText);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json?.data !== undefined ? json.data : json;
}

let refreshing = null;
async function api(method, path, body, headers) {
  try {
    return await rawApi(method, path, body, headers);
  } catch (e) {
    if (e.status === 401 && S.refreshToken) {
      if (!refreshing) {
        refreshing = (async () => {
          const r = await fetch(API + '/auth/refresh', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: S.refreshToken }),
          });
          const j = await r.json();
          if (!r.ok) throw new Error('session expired');
          S.token = j.data.accessToken; S.refreshToken = j.data.refreshToken;
          saveSession();
        })().finally(() => { refreshing = null; });
      }
      try { await refreshing; return await rawApi(method, path, body, headers); }
      catch { doLogout(false); throw new Error('Session expired — please log in again'); }
    }
    throw e;
  }
}

function saveSession() { localStorage.setItem('pf_session', JSON.stringify({ token: S.token, refreshToken: S.refreshToken })); }
function clearSession() { localStorage.removeItem('pf_session'); }

/* ---------- modal ---------- */
function openModal(title, html, wide) {
  document.getElementById('modal-root').innerHTML =
    `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal${wide ? ' wide' : ''}"><div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>${html}</div></div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

function formModal(title, fields, submitLabel, onSubmit, wide) {
  const body = fields.map((f) => {
    const req = f.required ? 'required' : '';
    if (f.type === 'select') {
      const opts = f.options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(f.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
      return `<label>${esc(f.label)}<select name="${f.name}" ${req}>${opts}</select></label>`;
    }
    if (f.type === 'textarea') return `<label>${esc(f.label)}<textarea name="${f.name}" rows="3" ${req}>${esc(f.value || '')}</textarea></label>`;
    if (f.type === 'datetime') return `<label>${esc(f.label)}<input type="datetime-local" name="${f.name}" value="${esc(f.value || '')}" ${req}/></label>`;
    if (f.type === 'number') return `<label>${esc(f.label)}<input type="number" name="${f.name}" value="${f.value ?? ''}" step="${f.step || '1'}" min="${f.min ?? ''}" ${req}/></label>`;
    if (f.type === 'checkbox') return `<label class="check"><input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''}/> ${esc(f.label)}</label>`;
    return `<label>${esc(f.label)}<input type="${f.hint || 'text'}" name="${f.name}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" ${req}/></label>`;
  }).join('');
  openModal(title, `<form id="mform">${body}
    <div class="modal-actions">
      <button type="button" class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn primary" type="submit">${esc(submitLabel)}</button>
    </div></form>`, wide);
  document.getElementById('mform').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    for (const f of fields) data[f.name] = f.type === 'checkbox' ? fd.get(f.name) === 'on' : fd.get(f.name);
    try {
      await onSubmit(data);
      closeModal();
      toast('Success');
      render();
    } catch (err) { toast(err.message || 'Failed', false); }
  };
}

const badge = (text, cls) => `<span class="badge ${cls}">${esc(text)}</span>`;
const statusBadge = (s) => {
  const map = {
    CEO: 'b-gold', CFO: 'b-blue', CTO: 'b-blue', CPO: 'b-blue', PM: 'b-gray', DEVELOPER: 'b-gray',
    BULLISH: 'b-green', STABLE: 'b-yellow', BANKRUPT_RISK: 'b-red',
    PROPOSED: 'b-yellow', APPROVED: 'b-blue', CEO_APPROVED: 'b-green', REJECTED: 'b-red', EXECUTED: 'b-green',
    SUBMITTED: 'b-yellow', CTO_VERIFIED: 'b-green',
    ACTIVE: 'b-blue', REPAID: 'b-green', DEFAULTED: 'b-red',
    SCHEDULED: 'b-yellow', COMPLETED: 'b-green', CANCELLED: 'b-gray',
    DISPATCHED: 'b-yellow', ACKNOWLEDGED: 'b-green',
    CRITICAL: 'b-red', MAJOR: 'b-yellow', MINOR: 'b-blue', LOW: 'b-gray',
    BACKLOG: 'b-gray', TODO: 'b-gray', IN_PROGRESS: 'b-blue', FLAGGED_COMPLETE: 'b-yellow', PM_VERIFIED: 'b-yellow', CLOSED: 'b-green',
    HIGH: 'b-yellow', PENDING: 'b-gray', CLIENT_REVIEW: 'b-yellow', PAID: 'b-green',
    CTO_AUDIT: 'b-yellow',
  };
  return badge(s, map[s] || 'b-gray');
};

async function loadSquads() {
  try { S.squads = await api('GET', '/squads'); } catch { S.squads = []; }
  return S.squads;
}
const squadName = (id) => S.squads.find((s) => s.id === id)?.name || id?.slice(0, 8) || '—';

/* ============================== auth ============================== */
function loginView(msg) {
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      <div class="login-brand">
        <div class="logo">P</div>
        <div>
          <h1>POINTFEX <span>ERP</span></h1>
          <p class="slogan">"From an idea to a greater impact"</p>
        </div>
      </div>
      ${msg ? `<div class="login-error">${esc(msg)}</div>` : ''}
      <form id="login-form">
        <label>Email<input name="email" type="email" required placeholder="you@pointfex.com" autocomplete="username"/></label>
        <label>Password<input name="password" type="password" required autocomplete="current-password"/></label>
        <button class="btn primary" style="width:100%;justify-content:center;margin-top:6px" type="submit">Sign in to the studio</button>
      </form>
      <p class="login-foot">Venture Studio Console · CSE474 · Southeast University</p>
    </div>`;
  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    try {
      const data = await rawApi('POST', '/auth/login', fd);
      S.token = data.accessToken; S.refreshToken = data.refreshToken; S.user = null;
      saveSession();
      await boot();
    } catch (err) { loginView(err.message); }
  };
}

function doLogout(redirect = true) {
  const t = S.token;
  S.token = S.refreshToken = S.user = null;
  clearSession();
  if (t) fetch(API + '/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' } }).catch(() => {});
  if (redirect) loginView();
}

/* ============================== shell ============================== */
const TABS = [
  { id: 'overview', label: 'Overview', show: () => true },
  { id: 'kanban', label: 'Tasks', show: () => true },
  { id: 'squads', label: 'Squads', show: () => true },
  { id: 'roster', label: 'People', show: () => canManage() || isExec() },
  { id: 'payroll', label: 'Payroll', show: () => isPM() || isCPO() || isCEO() },
  { id: 'finance', label: 'Finance', show: () => isExec() || isPM() },
  { id: 'governance', label: 'Governance', show: () => isExec() },
  { id: 'marketplace', label: 'Marketplace', show: () => true },
  { id: 'consultancy', label: 'Consultancy', show: () => true },
  { id: 'quality', label: 'Quality & Certs', show: () => true },
  { id: 'bounty', label: 'Bug Bounty', show: () => true },
  { id: 'clients', label: 'Clients', show: () => isExec() || isPM() },
  { id: 'notices', label: 'Notices', show: () => true },
  { id: 'chaos', label: 'Chaos', show: () => isCEO() || isPM() },
  { id: 'leaderboard', label: 'Leaderboard', show: () => true },
  { id: 'settings', label: 'Settings', show: () => isCEO() },
];
const TAB_TITLES = {
  overview: ['Overview', 'Your studio snapshot'],
  kanban: ['Task Board', 'Anti-gaming state machine — git proof, PM gate, CTO gate'],
  squads: ['Squads', 'Dynamic roster · elastic headcount · fractional allocation'],
  roster: ['People', 'Create profiles, change roles, reset passwords'],
  payroll: ['Weekly Lab Payroll', 'PM proposes ≤ ৳10,000 · CHRO audits & disburses'],
  finance: ['Finance', 'Sprint pool ৳150,000 · 5% tax · loans · equity'],
  governance: ['Governance', '2-of-3 board vote → CEO sign-off'],
  marketplace: ['Marketplace', 'Boilerplate store — certified authors, squad licenses'],
  consultancy: ['Consultancy', '15-minute architecture office hours — ৳4,000, 50/50 split'],
  quality: ['Quality & Certifications', 'Code audit citations · provider certification gate'],
  bounty: ['Bug Bounty Arena', 'Cross-squad adversarial QA · escrowed pools'],
  clients: ['Real Clients', 'Escrow funding · CTO gate · 25/65/10 revenue waterfall'],
  notices: ['Secure Notices', 'End-to-end encrypted · zero-knowledge server'],
  chaos: ['Chaos Console', 'Live lab incidents and automated penalties'],
  leaderboard: ['Leaderboard', 'Score = 50% squad valuation + 50% wallet'],
  settings: ['System Settings', 'Economic constants — CEO only'],
};

function renderShell() {
  const u = S.user;
  const tabs = TABS.filter((t) => t.show());
  document.getElementById('app').innerHTML = `
    <nav class="sidebar">
      <div class="brand">POINT<span>FEX</span><em>ERP</em></div>
      ${tabs.map((t) => `<a class="nav-btn ${S.tab === t.id ? 'active' : ''}" href="#" onclick="event.preventDefault();setTab('${t.id}')">${t.label}</a>`).join('')}
      <div class="spacer"></div>
      <div class="userbox">
        <div class="name">${esc(u.fullName)}</div>
        <div class="role">${esc(u.role)}</div>
        <div class="wallet">${money(u.walletBalance)}</div>
        <button class="btn sm ghost" style="margin-top:8px;width:100%;justify-content:center" onclick="doLogout()">Log out</button>
      </div>
    </nav>
    <main class="main">
      <header class="topbar">
        <div><h2>${TAB_TITLES[S.tab]?.[0] || ''}</h2><div class="sub">${TAB_TITLES[S.tab]?.[1] || ''}</div></div>
        <div class="row">
          <span id="sprint-chip" class="sprint-chip ${isExec() ? 'editable' : ''}" ${isExec() ? "title='Click to change the active sprint'" : ''} onclick="${isExec() ? "uiSetSprint()" : ''}">Sprint ${S.currentSprint ?? '—'}</span>
          <div id="tab-actions" class="row"></div>
        </div>
      </header>
      <div id="content"></div>
    </main>`;
}
function setTab(id) { S.tab = id; renderShell(); render(); }
function tabActions(html) { const el = document.getElementById('tab-actions'); if (el) el.innerHTML = html; }
const C = () => document.getElementById('content');

async function render() {
  if (!S.user) return;
  try { S.currentSprint = (await api('GET', '/settings/current-sprint')).sprintNumber; } catch { /* */ }
  const chip = document.getElementById('sprint-chip');
  if (chip) chip.textContent = 'Sprint ' + (S.currentSprint ?? '—');
  const views = {
    overview: viewOverview, kanban: viewKanban, squads: viewSquads, roster: viewRoster,
    payroll: viewPayroll, finance: viewFinance, governance: viewGovernance,
    marketplace: viewMarketplace, consultancy: viewConsultancy, quality: viewQuality,
    bounty: viewBounty, clients: viewClients, notices: viewNotices, chaos: viewChaos,
    leaderboard: viewLeaderboard, settings: viewSettings,
  };
  await loadSquads();
  await views[S.tab]?.();
}

/* ============================== views ============================== */

async function viewOverview() {
  const me = await api('GET', '/dashboard/me');
  let noticesHtml = '';
  try {
    const notices = await api('GET', '/notices');
    const unread = notices.filter((n) => n.status !== 'ACKNOWLEDGED').length;
    noticesHtml = `<div class="panel"><h3>Recent notices ${unread ? badge(unread + ' unread', 'b-yellow') : ''}</h3>
      ${notices.slice(0, 4).map((n) => `<div class="list-item"><div class="top"><b>${esc(n.title)}</b>${statusBadge(n.status)}</div>
        <div class="muted" style="font-size:12px;margin-top:4px">${esc(n.category)} · from ${esc(n.sender?.fullName || '')} · ${dt(n.createdAt)}</div></div>`).join('') || '<div class="empty">No notices</div>'}</div>`;
  } catch { /* */ }
  C().innerHTML = `
    <div class="cards">
      <div class="card"><div class="k">My Wallet</div><div class="v money">${money(me.walletBalance)}</div></div>
      <div class="card"><div class="k">Open Tasks</div><div class="v">${me.openTasks ?? 0}</div></div>
      <div class="card"><div class="k">Latest DPI</div><div class="v">${me.latestDpi ?? '—'}</div></div>
      <div class="card"><div class="k">My Squads</div><div class="v">${me.squads?.length || 0}</div></div>
    </div>
    ${me.squads?.length ? `<div class="panel"><h3>My squads</h3><table><tr><th>Squad</th><th>Treasury</th><th>Health</th></tr>
      ${me.squads.map((s) => `<tr><td>${esc(s.name)}</td><td class="money">${money(s.balance)}</td><td class="health-${s.health}">${statusBadge(s.health)}</td></tr>`).join('')}</table></div>` : ''}
    ${noticesHtml}`;
}

/* ------------------------------ Tasks / Kanban ------------------------------ */
const KANBAN_COLS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'FLAGGED_COMPLETE', 'PM_VERIFIED', 'CTO_VERIFIED', 'CLOSED'];

async function viewKanban() {
  const squadOpts = isExec() ? S.squads : mySquads();
  if (!squadOpts.length) { C().innerHTML = '<div class="panel empty">No squad membership</div>'; return; }
  if (!S.kanbanSquad || !squadOpts.find((s) => s.id === S.kanbanSquad)) S.kanbanSquad = squadOpts[0].id;
  const tasks = await api('GET', '/tasks?squadId=' + S.kanbanSquad);
  const byStatus = {};
  KANBAN_COLS.forEach((c) => (byStatus[c] = []));
  tasks.forEach((t) => (byStatus[t.status] || (byStatus[t.status] = [])).push(t));

  tabActions(`
    <select class="inp" onchange="S.kanbanSquad=this.value;render()">
      ${squadOpts.map((s) => `<option value="${s.id}" ${s.id === S.kanbanSquad ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
    </select>
    ${isPM() || isExec() ? '<button class="btn primary" onclick="uiCreateTask()">+ New task</button>' : ''}`);

  C().innerHTML = `<div class="kanban">${KANBAN_COLS.map((col) => `
    <div class="kcol"><h4><span>${col.replace('_', ' ')}</span><span>${byStatus[col].length}</span></h4>
      ${byStatus[col].map((t) => `
        <div class="kcard" onclick="uiTaskDetail('${t.id}')">
          <div class="t">${esc(t.title)}</div>
          <div class="m"><span>${esc(t.priority)}</span></div>
          <div class="m"><span>${esc(t.assignedTo?.fullName || 'unassigned')}</span></div>
        </div>`).join('') || '<div class="muted" style="font-size:11.5px;padding:6px 2px">—</div>'}
    </div>`).join('')}
  </div>`;
}

function uiSetSprint() {
  formModal('Set active sprint (C-level only)', [
    { name: 'sprintNumber', label: 'Sprint number', type: 'number', value: S.currentSprint || 1, required: true },
  ], 'Set sprint', async (d) => {
    await api('POST', '/settings/current-sprint', { sprintNumber: +d.sprintNumber });
    S.currentSprint = +d.sprintNumber;
  });
}

function uiCreateTask() {
  const squadOpts = isExec() ? S.squads : mySquads();
  formModal('Create task', [
    { name: 'squadId', label: 'Squad', type: 'select', options: squadOpts.map((s) => ({ value: s.id, label: s.name })), required: true },
    { name: 'title', label: 'Title', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'priority', label: 'Priority', type: 'select', options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => ({ value: p, label: p })), value: 'MEDIUM' },
  ], 'Create', async (d) => {
    const members = await api('GET', '/squads/' + d.squadId);
    const devOpts = members.members.filter((m) => m.role === 'DEVELOPER').map((m) => ({ value: m.userId, label: m.fullName }));
    if (devOpts.length) {
      formModal('Assign developer', [
        { name: 'assignedToId', label: 'Assignee', type: 'select', options: [{ value: '', label: '— leave in backlog —' }, ...devOpts] },
      ], 'Assign', async (d2) => {
        if (d2.assignedToId) d.assignedToId = d2.assignedToId;
        await api('POST', '/tasks', d);
      });
    } else {
      await api('POST', '/tasks', d);
    }
  });
}

async function uiTaskDetail(id) {
  const t = await api('GET', '/tasks/' + id);
  const canStart = t.status === 'TODO';
  const canFlag = t.status === 'IN_PROGRESS' && t.assignedToId === S.user.id;
  const canPm = t.status === 'FLAGGED_COMPLETE' && (isPM() || isCPO() || isCTO());
  const canCto = t.status === 'PM_VERIFIED' && isCTO();
  const canClose = t.status === 'CTO_VERIFIED' && (isPM() || isCTO());

  openModal(t.title, `
    <div class="pillrow" style="margin-bottom:10px">${statusBadge(t.status)} ${badge(t.priority, t.priority === 'CRITICAL' ? 'b-red' : 'b-gray')} ${badge(t.storyPoints + ' pts', 'b-blue')}</div>
    <p class="muted">${esc(t.description || 'No description')}</p>
    <table>
      <tr><td>Assignee</td><td>${esc(t.assignedTo?.fullName || '—')}</td></tr>
      <tr><td>Squad</td><td>${esc(t.squad?.name)}</td></tr>
      <tr><td>PR / Commit</td><td class="mono">${esc(t.gitPrUrl || t.gitCommitHash || '—')}</td></tr>
      ${t.pmFeedback ? `<tr><td>PM feedback</td><td>${esc(t.pmFeedback)}</td></tr>` : ''}
      ${t.ctoCritique ? `<tr><td>CTO critique</td><td>${esc(t.ctoCritique)}</td></tr>` : ''}
      ${t.pmPenaltyPoints ? `<tr><td>Penalty points</td><td style="color:var(--danger)">-${t.pmPenaltyPoints}</td></tr>` : ''}
    </table>
    <h3 style="margin:14px 0 8px">Audit trail</h3>
    ${(t.auditEvents || []).slice(0, 8).map((a) => `<div class="muted" style="font-size:12px;padding:3px 0">${dt(a.createdAt)} — <b>${esc(a.changedBy?.fullName || '')}</b>: ${esc(a.fromStatus)} → ${esc(a.toStatus)} ${a.comment ? '· ' + esc(a.comment.slice(0, 90)) : ''}</div>`).join('') || '<div class="empty">No events</div>'}
    <div class="modal-actions" style="flex-wrap:wrap">
      ${canStart ? `<button class="btn primary" onclick="act('POST','/tasks/${t.id}/start')">Start work</button>` : ''}
      ${canFlag ? `<button class="btn primary" onclick="uiFlag('${t.id}')">Flag complete</button>` : ''}
      ${canPm ? `<button class="btn good" onclick="uiPmVerify('${t.id}')">PM verify</button>
                  <button class="btn bad" onclick="uiPmReject('${t.id}')">PM reject</button>` : ''}
      ${canCto ? `<button class="btn good" onclick="act('POST','/tasks/${t.id}/cto-verify',{critique:'Architecture & coverage verified'})">CTO pass</button>
                  <button class="btn bad" onclick="uiCtoReject('${t.id}')">CTO reject</button>` : ''}
      ${canClose ? `<button class="btn primary" onclick="act('POST','/tasks/${t.id}/close')">Close</button>` : ''}
    </div>`);
}

async function act(method, path, body, idem) {
  try {
    await api(method, path, body, idem ? { 'X-Idempotency-Key': crypto.randomUUID() } : undefined);
    closeModal(); toast('Success'); render();
  } catch (e) { toast(e.message, false); }
}

function uiFlag(id) {
  formModal('Flag complete — git proof required', [
    { name: 'gitPrUrl', label: 'Pull request URL', value: 'https://github.com/pointfex/squad-1/pull/' + Math.floor(Math.random() * 99 + 10) },
    { name: 'gitCommitHash', label: 'Commit hash', value: Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('') },
  ], 'Flag complete', (d) => act('POST', `/tasks/${id}/flag-complete`, d));
}
function uiPmVerify(id) {
  formModal('PM verification', [{ name: 'comment', label: 'Comment', type: 'textarea', value: 'Acceptance criteria met, commits verified.' }], 'Verify', (d) => act('POST', `/tasks/${id}/pm-verify`, d));
}
function uiPmReject(id) {
  formModal('PM rejection — premature flag', [
    { name: 'isPremature', label: 'Premature flag (applies DPI penalty)', type: 'checkbox', value: true },
    { name: 'penaltyPoints', label: 'Penalty points (15-50)', type: 'number', value: 25 },
    { name: 'feedback', label: 'Feedback', type: 'textarea', required: true, value: 'PR contains empty stub functions; tests commented out.' },
  ], 'Reject', (d) => act('POST', `/tasks/${id}/pm-reject`, { isPremature: !!d.isPremature, penaltyPoints: +d.penaltyPoints, feedback: d.feedback }));
}
function uiCtoReject(id) {
  formModal('CTO rejection — fine + PMHI demerit', [
    { name: 'citationType', label: 'Citation type', type: 'select', options: ['CODE_SMELL', 'BAD_MERGE_REQUEST', 'SECURITY_VULNERABILITY'].map((v) => ({ value: v, label: v })) },
    { name: 'critique', label: 'Critique (min 20 chars)', type: 'textarea', required: true, value: 'Unit tests are trivially mocked; business logic leaks into controllers.' },
  ], 'Reject & fine', (d) => act('POST', `/tasks/${id}/cto-reject`, d));
}

/* ------------------------------ Squads (CRUD) ------------------------------ */
async function viewSquads() {
  tabActions(`
    ${canManage() ? '<button class="btn primary" onclick="uiSquadCreate()">+ New squad</button>' : ''}
    ${canManage() ? '<button class="btn" onclick="uiTransferMember()">Transfer member</button>' : ''}`);
  C().innerHTML = `<div class="panel"><table>
    <tr><th>Squad</th><th>Members</th><th>Treasury</th><th>Valuation</th><th>Health</th><th>Tasks</th>${canManage() ? '<th></th>' : ''}</tr>
    ${S.squads.map((s) => `<tr>
      <td><b>${esc(s.name)}</b>${s.isActive === false ? ' ' + badge('inactive', 'b-red') : ''}</td>
      <td>${s.memberCount}</td><td class="money">${money(s.balance)}</td>
      <td>${money(s.valuation)}</td><td class="health-${s.healthStatus}">${statusBadge(s.healthStatus)}</td><td>${s.taskCount}</td>
      <td class="row">
        <button class="btn sm" onclick="uiSquadDetail('${s.id}')">Open</button>
        <button class="btn sm" onclick="uiSquadGit('${s.id}')">Git</button>
        ${canManage() ? `<button class="btn sm ghost" onclick="uiSquadEdit('${s.id}','${esc(s.name)}','${esc(s.description || '')}',${s.isActive !== false})">Edit</button>` : ''}
      </td></tr>`).join('')}
  </table></div>`;
}

async function uiSquadGit(squadId) {
  const squad = S.squads.find((s) => s.id === squadId);
  const canConnect = isExec() || (isPM() && mySquads().some((s) => s.id === squadId));
  openModal('GitHub · ' + esc(squad?.name || 'Squad'), `
    <div id="git-body"><div class="empty">Loading repository activity…</div></div>
    ${canConnect ? `<div class="modal-actions" style="justify-content:flex-start"><button class="btn primary" onclick="uiGitConnect('${squadId}')">Connect / change repository</button></div>` : '<div class="muted" style="font-size:11.5px;margin-top:8px">Only the squad PM or C-level can connect the repository.</div>'}`, true);
  await refreshGitFeed(squadId);
}

async function refreshGitFeed(squadId) {
  const body = document.getElementById('git-body');
  if (!body) return;
  try {
    const r = await api('GET', `/squads/${squadId}/github/activity`);
    body.innerHTML = `
      <div class="muted" style="font-size:12px;margin-bottom:8px">${esc(r.repoUrl)} · <button class="btn sm ghost" onclick="refreshGitFeed('${squadId}')">↻ refresh</button></div>
      ${r.commits.map((c) => `<div class="commit">
        <div class="msg"><span class="sha">${esc(c.sha)}</span> ${esc(c.message)}</div>
        <div class="meta">${esc(c.author)} · ${dt(c.date)}</div>
      </div>`).join('') || '<div class="empty">No commits found</div>'}`;
  } catch (e) {
    body.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

function uiGitConnect(squadId) {
  formModal('Connect GitHub repository', [
    { name: 'repoUrl', label: 'Repository URL', required: true, placeholder: 'https://github.com/pointfex/squad-1' },
    { name: 'token', label: 'Personal Access Token (optional — needed for private repos)', placeholder: 'ghp_…' },
  ], 'Connect', async (d) => {
    await api('PUT', `/squads/${squadId}/github`, { repoUrl: d.repoUrl, token: d.token || undefined });
    closeModal();
    await uiSquadGit(squadId);
  });
}

function uiSquadCreate() {  formModal('Create squad', [
    { name: 'name', label: 'Squad name', required: true, placeholder: 'Squad 7' },
    { name: 'description', label: 'Description', placeholder: 'Product engineering squad' },
    { name: 'initialBalance', label: 'Initial treasury (BDT, from system reserve)', type: 'number', value: 100000 },
  ], 'Create squad', (d) => act('POST', '/squads', { ...d, initialBalance: +d.initialBalance }));
}

function uiSquadEdit(id, name, description, isActive) {
  formModal('Edit squad', [
    { name: 'name', label: 'Squad name', value: name, required: true },
    { name: 'description', label: 'Description', value: description },
    { name: 'isActive', label: 'Active', type: 'checkbox', value: isActive },
  ], 'Save', (d) => act('PATCH', `/squads/${id}`, { name: d.name, description: d.description, isActive: !!d.isActive }));
}

async function uiSquadDetail(id) {
  const s = await api('GET', '/squads/' + id);
  let addable = [];
  if (canManage()) {
    try { addable = (await api('GET', '/users')).filter((u) => !(s.members || []).some((m) => m.userId === u.id)); } catch { addable = []; }
  }
  openModal('Squad · ' + esc(s.name), `
    <div class="pillrow" style="margin-bottom:10px">${statusBadge(s.healthStatus)} ${s.isActive === false ? badge('inactive', 'b-red') : ''} <span class="badge b-gold">${money(s.balance)}</span> <span class="badge b-blue">valuation ${money(s.valuation)}</span></div>
    <table><tr><th>Member</th><th>Role</th><th>Allocation</th>${canManage() ? '<th></th>' : ''}</tr>
      ${(s.members || []).map((m) => `<tr><td>${esc(m.fullName)}<div class="muted" style="font-size:11px">${esc(m.email)}</div></td><td>${statusBadge(m.role)}</td><td>${(Number(m.allocation) * 100).toFixed(0)}%</td>
        ${canManage() ? `<td><button class="btn sm bad" onclick="uiRemoveMember('${id}','${m.userId}','${esc(m.fullName)}')">Remove</button></td>` : ''}</tr>`).join('') || '<tr><td colspan="4" class="empty">No members</td></tr>'}
    </table>
    ${canManage() && addable.length ? `<div class="modal-actions" style="justify-content:flex-start"><button class="btn primary" onclick="uiAddMember('${id}')">+ Add member</button></div>` : ''}`);
}

function uiAddMember(squadId) {
  api('GET', '/users').then((users) => {
    const squad = S.squads.find((s) => s.id === squadId);
    formModal('Add member to ' + (squad?.name || 'squad'), [
      { name: 'userId', label: 'User', type: 'select', required: true, options: users.map((u) => ({ value: u.id, label: `${u.fullName} (${u.role})` })) },
      { name: 'role', label: 'Squad role', type: 'select', options: [{ value: 'DEVELOPER', label: 'DEVELOPER' }, { value: 'PM', label: 'PM (allocation must be 1.0)' }] },
      { name: 'allocation', label: 'Allocation (0.01–1.0)', type: 'number', value: 1, step: '0.01' },
    ], 'Add member', (d) => act('POST', `/squads/${squadId}/members`, { userId: d.userId, role: d.role, allocation: +d.allocation }));
  });
}

function uiRemoveMember(squadId, userId, name) {
  formModal('Remove ' + name + ' (৳5,000 fee to squad)', [
    { name: 'confirm', label: 'Type the member name to confirm', required: true },
  ], 'Remove', async (d) => {
    if (d.confirm !== name) throw new Error('Name does not match');
    await act('DELETE', `/squads/${squadId}/members/${userId}`, undefined, true);
  });
}

function uiTransferMember() {
  const all = S.squads;
  formModal('Transfer member (৳5,000 fee to destination squad)', [
    { name: 'userId', label: 'User ID', required: true, placeholder: 'paste user id from People' },
    { name: 'fromSquadId', label: 'From squad', type: 'select', options: all.map((s) => ({ value: s.id, label: s.name })) },
    { name: 'toSquadId', label: 'To squad', type: 'select', options: all.map((s) => ({ value: s.id, label: s.name })) },
  ], 'Transfer', (d) => act('POST', '/squads/members/transfer', d, true));
}

/* ------------------------------ People (CRUD) ------------------------------ */
async function viewRoster() {
  const users = await api('GET', '/users');
  tabActions('<button class="btn primary" onclick="uiUserCreate()">+ New member</button>');
  C().innerHTML = `<div class="panel"><table>
    <tr><th>Name</th><th>Role</th><th>Email</th><th>Student ID</th><th>Squads</th><th></th></tr>
    ${users.map((u) => `<tr>
      <td><b>${esc(u.fullName)}</b></td><td>${statusBadge(u.role)}</td>
      <td class="muted">${esc(u.email)}</td><td class="mono">${esc(u.studentId || '—')}</td>
      <td>${(u.squadMemberships || []).map((m) => esc(m.squad?.name || '')).join(', ') || '—'}</td>
      <td class="row">
        <button class="btn sm" onclick="uiCopy('${u.id}')">ID</button>
        ${canManage() ? `<button class="btn sm" onclick="uiUserEdit('${u.id}','${esc(u.fullName)}','${esc(u.email)}','${u.role}','${esc(u.studentId || '')}')">Edit</button>` : ''}
      </td></tr>`).join('')}
  </table></div>`;
}

function uiCopy(text) {
  navigator.clipboard?.writeText(text).then(() => toast('Copied: ' + text));
}

function uiUserCreate() {
  formModal('Create member profile', [
    { name: 'fullName', label: 'Full name', required: true, placeholder: 'Ayesha Rahman' },
    { name: 'email', label: 'Email', type: 'text', hint: 'email', required: true, placeholder: 'ayesha@pointfex.dev' },
    { name: 'password', label: 'Temporary password (min 8 chars)', required: true, value: 'Pointfex-' + Math.random().toString(36).slice(2, 8) },
    { name: 'role', label: 'Role', type: 'select', options: ['DEVELOPER', 'PM', 'CFO', 'CTO', 'CPO', 'CEO'].map((r) => ({ value: r, label: r })) },
    { name: 'studentId', label: 'Student ID (optional)', placeholder: 'CSE034' },
  ], 'Create profile', (d) => api('POST', '/users', { ...d, studentId: d.studentId || undefined }));
}

function uiUserEdit(id, fullName, email, role, studentId) {
  formModal('Edit member', [
    { name: 'fullName', label: 'Full name', value: fullName, required: true },
    { name: 'email', label: 'Email', type: 'text', hint: 'email', value: email, required: true },
    { name: 'role', label: 'Role', type: 'select', value: role, options: ['DEVELOPER', 'PM', 'CFO', 'CTO', 'CPO', 'CEO'].map((r) => ({ value: r, label: r })) },
    { name: 'studentId', label: 'Student ID', value: studentId },
    { name: 'password', label: 'New password (leave blank to keep)', placeholder: 'min 8 chars' },
    { name: 'isActive', label: 'Active (uncheck to deactivate & revoke sessions)', type: 'checkbox', value: true },
  ], 'Save changes', (d) => act('PATCH', `/users/${id}`, {
    fullName: d.fullName, email: d.email, role: d.role, studentId: d.studentId || null,
    isActive: !!d.isActive, ...(d.password ? { password: d.password } : {}),
  }));
}

/* ------------------------------ Payroll ------------------------------ */
const TIER_CAPS = { STAR_PERFORMER: 3500, REGULAR: 2000, UNDERPERFORMER: 1000, SLACKER: 0 };

async function viewPayroll() {
  const status = S.payrollStatus || 'SUBMITTED';
  const proposals = await api('GET', '/payroll' + (isCPO() || isCEO() ? '?status=' + status : ''));
  tabActions(`
    ${isCPO() || isCEO() ? `<select class="inp" onchange="S.payrollStatus=this.value;render()">
      ${['SUBMITTED', 'APPROVED', 'REJECTED'].map((s) => `<option ${s === status ? 'selected' : ''}>${s}</option>`).join('')}</select>` : ''}
    ${isPM() ? '<button class="btn primary" onclick="uiPayrollSubmit()">+ New proposal</button>' : ''}
    ${isCPO() ? '<button class="btn bad" onclick="uiSlackerFine()">Issue slacker fine</button>' : ''}`);
  C().innerHTML = proposals.length ? proposals.map((p) => `
    <div class="list-item"><div class="top">
      <div><b>${esc(p.squad?.name || '')}</b> · Lab ${p.labNumber} · ${money(p.totalProposed)}</div>
      <div class="row">${statusBadge(p.status)}
        ${isCPO() && p.status === 'SUBMITTED' ? `<button class="btn good sm" onclick="act('POST','/payroll/${p.id}/approve',null,true)">Approve & disburse</button>
          <button class="btn bad sm" onclick="uiPayrollReject('${p.id}')">Reject</button>` : ''}
      </div></div>
      <div class="itemlist">${p.lineItems.map((li) => `<div class="muted" style="font-size:12.5px">${esc(li.user?.fullName || li.userId)} — ${esc(li.tier)} · ${money(li.amount)} <i>${esc(li.justification || '')}</i></div>`).join('')}</div>
    </div>`).join('') : '<div class="panel empty">No proposals</div>';
}

function uiPayrollReject(id) {
  formModal('Reject payroll proposal', [{ name: 'reason', label: 'Reason', type: 'textarea', required: true }], 'Reject', (d) => act('POST', `/payroll/${id}/reject`, d));
}

function uiSlackerFine() {
  formModal('Slacker fine (৳2,000 — ৳500 CPO / ৳1,500 reserve)', [
    { name: 'targetUserId', label: 'Target user ID', required: true, placeholder: 'from People → ID' },
    { name: 'targetSquadId', label: 'Squad', type: 'select', options: S.squads.map((s) => ({ value: s.id, label: s.name })) },
    { name: 'reason', label: 'Reason', type: 'textarea', required: true, value: 'Zero commits and missed standup this lab.' },
  ], 'Issue fine', (d) => act('POST', '/fines/slacker', d, true));
}

async function uiPayrollSubmit() {
  formModal('New payroll proposal — step 1', [
    { name: 'squadId', label: 'Squad', type: 'select', options: mySquads().map((s) => ({ value: s.id, label: s.name })) },
    { name: 'labNumber', label: 'Lab number', type: 'number', value: (S.payrollLab || 0) + 1, required: true },
  ], 'Next', async (d) => {
    d.labNumber = +d.labNumber;
    const detail = await api('GET', '/squads/' + d.squadId);
    const members = detail.members;
    const rows = members.map((m) => ({ user: m, tier: 'REGULAR', amount: TIER_CAPS.REGULAR }));
    const render2 = () => {
      const total = rows.reduce((a, r) => a + (+r.amount || 0), 0);
      openModal('Distribute lab payroll (budget ৳10,000)', `
        <form id="mform2">
          ${rows.map((r, i) => `
            <div class="fieldrow" style="margin-bottom:8px">
              <label>${esc(r.user.fullName)}
                <select name="tier${i}" onchange="rowTier(${i},this.value)">
                  ${Object.keys(TIER_CAPS).map((t) => `<option value="${t}" ${r.tier === t ? 'selected' : ''}>${t} (≤ ৳${TIER_CAPS[t]})</option>`).join('')}
                </select></label>
              <label>Amount<input name="amount${i}" type="number" value="${r.amount}" max="3500" min="0" style="margin-top:22px"/></label>
            </div>`).join('')}
          <div style="font-weight:700;margin:8px 0">Total: <span class="money" id="pf-total">${total}</span></div>
          <div class="modal-actions"><button type="button" class="btn ghost" onclick="closeModal()">Cancel</button>
            <button class="btn primary" type="submit" ${total > 10000 ? 'disabled' : ''}>Submit proposal</button></div>
        </form>`);
      document.querySelectorAll('#mform2 input[name^=amount]').forEach((inp, i) => {
        inp.oninput = () => { rows[i].amount = +inp.value; document.getElementById('pf-total').textContent = rows.reduce((a, r) => a + (+r.amount || 0), 0); };
      });
      document.getElementById('mform2').onsubmit = async (e) => {
        e.preventDefault();
        const lineItems = rows.map((r) => ({ userId: r.user.userId, tier: r.tier, amount: +r.amount, justification: 'via console' }));
        await api('POST', '/payroll', { squadId: d.squadId, labNumber: d.labNumber, lineItems });
        closeModal(); toast('Proposal submitted'); render();
      };
    };
    window.rowTier = (i, t) => { rows[i].tier = t; rows[i].amount = TIER_CAPS[t]; render2(); };
    render2();
  });
}

/* ------------------------------ Finance ------------------------------ */
async function viewFinance() {
  const sections = [];
  let payouts = [], loans = [], equity = null;
  try { payouts = await api('GET', '/sprint-payouts'); } catch { /* */ }
  try { loans = await api('GET', '/loans'); } catch { /* */ }

  if (isCFO() || isCEO()) {
    sections.push(`
      <div class="panel"><h3>Sprint payouts</h3>
        ${payouts.length ? `<table><tr><th>Sprint</th><th>Status</th><th>Pool</th><th>Actions</th></tr>
          ${payouts.map((p) => `<tr><td>Sprint ${p.sprintNumber}</td><td>${statusBadge(p.status)}</td><td class="money">${money(p.totalPool)}</td>
            <td class="row">${isCEO() && p.status === 'PROPOSED' ? `<button class="btn good sm" onclick="act('POST','/sprint-payouts/${p.id}/ceo-approve')">CEO approve</button>` : ''}
              ${isCFO() && p.status === 'APPROVED' ? `<button class="btn primary sm" onclick="act('POST','/sprint-payouts/${p.id}/execute',null,true)">Execute</button>` : ''}</td></tr>`).join('')}
        </table>` : '<div class="empty">No payouts yet</div>'}</div>`);
  }
  if (isCFO()) {
    try { equity = await api('GET', '/equity'); } catch { /* */ }
    sections.push(`
      <div class="panel"><h3>Venture equity</h3>
        ${equity ? `<div class="muted" style="margin-bottom:8px">Dividends collected: <span class="money">${money(equity.dividendsReceived)}</span></div>
        <table><tr><th>Squad</th><th>Stake</th><th>Invested</th><th>Sprint</th><th>Active</th></tr>
          ${equity.stakes.map((s) => `<tr><td>${esc(s.squad?.name || '')}</td><td>${(Number(s.stakePercent) * 100).toFixed(0)}%</td><td class="money">${money(s.investedAmount)}</td><td>${s.sprintNumber}</td><td>${s.isActive ? '✓' : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No stakes</td></tr>'}
        </table>` : ''}</div>`);
  }

  sections.push(`
    <div class="panel"><h3>Emergency loans <span class="muted" style="font-size:11.5px">Treasury &lt; ৳15,000 · 15% interest · 2-of-3 board + CEO</span></h3>
      ${loans.length ? `<table><tr><th>Squad</th><th>Principal</th><th>Total due</th><th>Status</th><th>Actions</th></tr>
        ${loans.map((l) => `<tr><td>${esc(l.borrowerSquad?.name || '')}</td><td class="money">${money(l.principalAmount)}</td><td class="money">${money(l.totalDue)}</td>
          <td>${statusBadge(l.status)}${l.disbursedAt ? '' : badge('awaiting governance', 'b-yellow')}</td>
          <td class="row">${isCFO() && !l.disbursedAt ? `<button class="btn primary sm" onclick="act('POST','/loans/${l.id}/approve',null,true)">Disburse</button>` : ''}
            ${l.status === 'ACTIVE' && l.disbursedAt && (isPM() || isCEO()) ? `<button class="btn good sm" onclick="act('POST','/loans/${l.id}/repay',null,true)">Repay</button>` : ''}</td></tr>`).join('')}
      </table>` : '<div class="empty">No loans</div>'}</div>`);

  if (isCEO() || isCFO()) {
    try {
      const txs = await api('GET', '/ledger/transactions?limit=15');
      sections.push(`<div class="panel"><h3>Ledger feed</h3><table><tr><th>When</th><th>Type</th><th>Amount</th><th>Description</th></tr>
        ${txs.map((t) => {
          const amt = t.entries.filter((e) => e.direction === 'DEBIT').reduce((a, e) => a + Number(e.amount), 0);
          return `<tr><td class="muted">${dt(t.createdAt)}</td><td>${badge(t.referenceType, 'b-blue')}</td><td class="money">${money(amt)}</td><td class="muted" style="font-size:12px">${esc(t.description || '')}</td></tr>`;
        }).join('')}</table></div>`);
    } catch { /* */ }
  }

  tabActions(`<div class="row">
    ${isCFO() ? '<button class="btn primary" onclick="uiPayoutNew()">New payout</button><button class="btn" onclick="uiEquityInvest()">Invest equity</button>' : ''}
    ${isPM() ? '<button class="btn" onclick="uiLoanApply()">Apply for loan</button>' : ''}</div>`);
  C().innerHTML = sections.join('');
}

function uiPayoutNew() {
  const rows = [...S.squads].sort((a, b) => b.balance - a.balance).map((s, i) => ({ s, rank: i + 1 }));
  openModal('Sprint payout — rank the squads', `
    <form id="mform3">
      <label>Sprint number<input name="sprintNumber" type="number" value="1" required/></label>
      ${rows.map((r, i) => `<div class="row" style="margin-bottom:6px;justify-content:space-between">
        <span>${esc(r.s.name)} <span class="muted">(bal ${money(r.s.balance)})</span></span>
        <span>Rank <input class="inp rank-input" name="rank${i}" type="number" min="1" max="9" value="${r.rank}"/></span></div>`).join('')}
      <div class="muted" style="font-size:11.5px;margin:8px 0">Distribution: 50k / 35k / 25k / 20k / 15k / 5k (ranks must be unique 1..N)</div>
      <div class="modal-actions"><button type="button" class="btn ghost" onclick="closeModal()">Cancel</button>
        <button class="btn primary" type="submit">Submit for CEO approval</button></div>
    </form>`);
  document.getElementById('mform3').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const rankings = rows.map((r, i) => ({ squadId: r.s.id, rank: +fd.get('rank' + i) }));
    await api('POST', '/sprint-payouts', { sprintNumber: +fd.get('sprintNumber'), rankings });
    closeModal(); toast('Payout proposed'); render();
  };
}

function uiEquityInvest() {
  formModal('Venture investment (10% equity, max 2 squads/sprint)', [
    { name: 'squadId', label: 'Squad', type: 'select', options: S.squads.map((s) => ({ value: s.id, label: s.name })) },
    { name: 'investedAmount', label: 'Amount (BDT)', type: 'number', value: 15000, required: true },
  ], 'Invest', (d) => act('POST', '/equity', { ...d, investedAmount: +d.investedAmount }));
}

function uiLoanApply() {
  formModal('Emergency loan application', [
    { name: 'squadId', label: 'Squad', type: 'select', options: mySquads().map((s) => ({ value: s.id, label: s.name })) },
    { name: 'principalAmount', label: 'Principal (BDT)', type: 'number', value: 20000, required: true },
  ], 'Apply', (d) => act('POST', '/loans', { ...d, principalAmount: +d.principalAmount }));
}

/* ------------------------------ Governance ------------------------------ */
async function viewGovernance() {
  const decisions = await api('GET', '/governance/decisions');
  let loans = [];
  if (isCFO() || isCEO()) { try { loans = await api('GET', '/loans'); } catch { /* */ } }
  const pendingLoans = loans.filter((l) => !l.disbursedAt && l.status === 'ACTIVE');
  S._loanOptions = pendingLoans.map((l) => ({ value: l.id, label: 'Loan ' + (l.borrowerSquad?.name || '') + ' — ' + money(l.principalAmount) }));

  tabActions(!isCEO() && isExec() ? '<button class="btn primary" onclick="uiPropose()">+ Propose decision</button>' : '');
  C().innerHTML = decisions.length ? decisions.map((d) => {
    const myVote = (d.votes || []).find((v) => v.voterId === S.user.id);
    const canVote = ['CFO', 'CTO', 'CPO'].includes(S.user.role) && d.proposedById !== S.user.id && !myVote && d.status === 'PROPOSED';
    const canDecide = isCEO() && ['PROPOSED', 'APPROVED'].includes(d.status);
    return `<div class="list-item"><div class="top">
      <div><b>${esc(d.title)}</b> ${statusBadge(d.status)} ${badge(d.category, 'b-blue')}</div>
      <div class="row">
        ${canVote ? `<button class="btn good sm" onclick="act('POST','/governance/decisions/${d.id}/vote',{vote:'APPROVE'})">Approve</button>
                    <button class="btn bad sm" onclick="act('POST','/governance/decisions/${d.id}/vote',{vote:'REJECT'})">Reject</button>` : ''}
        ${canDecide ? `<button class="btn good sm" onclick="act('POST','/governance/decisions/${d.id}/ceo-decide',{approve:true})">CEO sign-off</button>
                        <button class="btn bad sm" onclick="act('POST','/governance/decisions/${d.id}/ceo-decide',{approve:false})">CEO veto</button>` : ''}
      </div></div>
      <div class="muted" style="font-size:12.5px;margin-top:4px">${esc(d.description)}</div>
      <div class="itemlist">${(d.votes || []).map((v) => `<div style="font-size:12.5px">${esc(v.voter?.role)} ${esc(v.voter?.fullName || '')} — <b style="color:${v.vote === 'APPROVE' ? 'var(--accent2)' : 'var(--danger)'}">${v.vote}</b></div>`).join('') || '<span class="muted">No votes yet</span>'}</div>
    </div>`;
  }).join('') : '<div class="panel empty">No decisions</div>';
}

function uiPropose() {
  formModal('Propose board decision', [
    { name: 'title', label: 'Title', required: true },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'category', label: 'Category', type: 'select', options: ['LOAN_APPROVAL', 'SWAP_REQUEST', 'POLICY_CHANGE', 'EMERGENCY_ACTION'].map((c) => ({ value: c, label: c })) },
    { name: 'referenceId', label: 'Linked loan (for LOAN_APPROVAL)', type: 'select', options: [{ value: '', label: '— none —' }, ...(S._loanOptions || [])] },
  ], 'Propose', async (d) => {
    await api('POST', '/governance/decisions', { ...d, referenceId: d.referenceId || undefined });
  });
}

/* ------------------------------ Marketplace ------------------------------ */
async function viewMarketplace() {
  let listings = [], myCerts = [];
  try { listings = await api('GET', '/cto/marketplace/listings'); } catch { /* */ }
  try { myCerts = await api('GET', '/cto/certifications/me'); } catch { /* */ }
  const canAuthor = isCTO() || myCerts.some((c) => c.certificationType === 'MARKETPLACE_AUTHOR' && c.isPreapproved);

  tabActions(canAuthor ? '<button class="btn primary" onclick="uiListing()">+ Publish listing</button>' : '');
  C().innerHTML = `
    ${!canAuthor ? `<div class="panel muted" style="font-size:12.5px">Want to sell here? Apply for the <b>MARKETPLACE_AUTHOR</b> certification under Quality &amp; Certs (CTO-reviewed, score ≥ 80).</div>` : ''}
    <div class="cards-grid">
    ${listings.map((l) => `
      <div class="mcard">
        <div class="top"><b>${esc(l.title)}</b> ${l.isCtoVerified ? badge('CTO ✓', 'b-green') : ''}</div>
        <div class="muted" style="font-size:12.5px;margin:6px 0;min-height:32px">${esc(l.description || '')}</div>
        <div class="muted" style="font-size:11.5px">by ${esc(l.authorName)} · ${l.purchaseCount} sold</div>
        <div class="top" style="margin-top:10px">
          <span class="price">${money(l.price)}</span>
          ${isPM() ? `<button class="btn primary sm" onclick="uiPurchase('${l.id}')">Buy for squad</button>` : ''}
        </div>
      </div>`).join('') || '<div class="panel empty">No listings yet</div>'}
    </div>`;
}

function uiListing() {
  formModal('Publish marketplace listing', [
    { name: 'title', label: 'Title', required: true, placeholder: 'Enterprise BullMQ Event Bus Starter' },
    { name: 'price', label: 'Price (BDT)', type: 'number', value: 8000, required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'repositoryUrl', label: 'Repository URL', value: 'https://github.com/pointfex/starter' },
  ], 'Publish', (d) => act('POST', '/cto/marketplace/listings', { ...d, price: +d.price }));
}

function uiPurchase(listingId) {
  formModal('Purchase listing (100% goes to the author)', [
    { name: 'buyerSquadId', label: 'Squad', type: 'select', options: mySquads().map((s) => ({ value: s.id, label: s.name })) },
  ], 'Purchase', (d) => act('POST', `/cto/marketplace/listings/${listingId}/purchase`, d, true));
}

/* ------------------------------ Consultancy ------------------------------ */
async function viewConsultancy() {
  let bookings = [], consultants = [], myCerts = [];
  try { bookings = await api('GET', '/cto/consultancy/bookings'); } catch { /* */ }
  try { consultants = await api('GET', '/cto/certifications/consultants'); } catch { /* */ }
  try { myCerts = await api('GET', '/cto/certifications/me'); } catch { /* */ }
  S._consultantOptions = consultants.map((c) => ({ value: c.id, label: c.fullName + ' (' + c.role + ')' }));
  const canConsult = isCTO() || myCerts.some((c) => c.certificationType === 'CONSULTANT' && c.isPreapproved);

  tabActions(isPM() ? '<button class="btn primary" onclick="uiConsultBook()">Book a session</button>' : '');
  C().innerHTML = `
    <div class="cards">
      <div class="card"><div class="k">Session fee</div><div class="v money">৳4,000</div><div class="muted" style="font-size:11.5px">escrowed at booking</div></div>
      <div class="card"><div class="k">Consultant receives</div><div class="v money">৳2,000</div><div class="muted" style="font-size:11.5px">50% · rest to reserve</div></div>
      <div class="card"><div class="k">Bookable consultants</div><div class="v">${consultants.length}</div><div class="muted" style="font-size:11.5px">${consultants.map((c) => esc(c.fullName)).join(', ')}</div></div>
      <div class="card"><div class="k">Weekly cap</div><div class="v">2</div><div class="muted" style="font-size:11.5px">sessions / consultant</div></div>
    </div>
    ${canConsult ? '<div class="panel muted" style="font-size:12.5px">You are a certified consultant — complete your sessions below (min 50-word notes + PR link).</div>' : ''}
    <div class="panel"><table><tr><th>Consultant</th><th>Client squad</th><th>Scheduled</th><th>Status</th><th>Actions</th></tr>
      ${bookings.map((b) => `<tr><td>${esc(b.consultant?.fullName || '')}</td><td>${esc(b.clientSquad?.name || '')}</td><td class="muted">${dt(b.scheduledAt)}</td><td>${statusBadge(b.status)}</td>
        <td class="row">${b.status === 'SCHEDULED' && b.consultantId === S.user.id ? `<button class="btn good sm" onclick="uiConsultComplete('${b.id}')">Complete</button>` : ''}
          ${b.status === 'SCHEDULED' && isPM() ? `<button class="btn bad sm" onclick="act('POST','/cto/consultancy/bookings/${b.id}/cancel')">Cancel</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No bookings</td></tr>'}
    </table></div>`;
}

function uiConsultBook() {
  formModal('Book consultancy session (৳4,000 escrow)', [
    { name: 'consultantId', label: 'Consultant', type: 'select', options: S._consultantOptions || [] },
    { name: 'clientSquadId', label: 'Client squad', type: 'select', options: mySquads().map((s) => ({ value: s.id, label: s.name })) },
    { name: 'scheduledAt', label: 'Scheduled at', type: 'datetime', value: new Date(Date.now() + 864e5).toISOString().slice(0, 16), required: true },
  ], 'Book & escrow', (d) => act('POST', '/cto/consultancy/bookings', d, true));
}

function uiConsultComplete(id) {
  formModal('Complete session (min 50 words + PR link)', [
    { name: 'meetingNotes', label: 'Meeting notes (min 50 words)', type: 'textarea', required: true, value: 'Reviewed Postgres connection pooling strategies and advised migration to PgBouncer; refactored high-latency Prisma raw queries to indexed views; agreed on caching plan for next sprint; discussed retry policies for BullMQ workers and dead-letter handling going forward with the whole squad present in the call.' },
    { name: 'prLinks', label: 'PR links (one per line)', type: 'textarea', required: true, value: 'https://github.com/pointfex/squad-1/pull/104' },
  ], 'Complete & settle', (d) => act('POST', `/cto/consultancy/bookings/${id}/complete`, d));
}

/* ------------------------------ Quality & Certifications ------------------------------ */
async function viewQuality() {
  let citations = [], certQueue = null, myCerts = [];
  try { citations = await api('GET', '/cto/citations?limit=10'); } catch { /* */ }
  try { certQueue = await api('GET', '/cto/certifications/queue'); } catch { /* */ }
  try { myCerts = await api('GET', '/cto/certifications/me'); } catch { /* */ }
  const certByType = {}; myCerts.forEach((c) => { certByType[c.certificationType] = c; });

  tabActions(`<div class="row">
    <button class="btn" onclick="uiCertApply()">Apply for certification</button>
    ${isCTO() ? '<button class="btn bad" onclick="uiCitation()">+ Issue citation</button>' : ''}</div>`);

  C().innerHTML = `
    ${isCTO() ? `<div class="panel"><h3>Certification queue (${certQueue?.pendingCount || 0})</h3>
      ${(certQueue?.queue || []).map((c) => `<div class="list-item"><div class="top">
        <div><b>${esc(c.applicantName)}</b> — ${esc(c.certificationType)}</div>
        <button class="btn primary sm" onclick="uiCertReview('${c.id}')">Review & score</button></div>
        <div class="muted" style="font-size:12px;margin-top:4px">${esc(c.portfolioUrl || '')} ${esc(c.applicationNotes || '')}</div></div>`).join('') || '<div class="empty">Queue empty</div>'}</div>

    <div class="panel"><h3>Recent code audit citations</h3><table><tr><th>Squad</th><th>Type</th><th>Fine</th><th>When</th></tr>
      ${(citations.items || []).map((c) => `<tr><td>${esc(c.squad?.name || '')}</td><td>${badge(c.type, 'b-yellow')}</td><td class="money">${money(c.fineAmount)}</td><td class="muted">${dt(c.createdAt)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">None</td></tr>'}</table></div>` : ''}

    <div class="panel"><h3>My certifications</h3>
      <div class="pillrow">${Object.keys(certByType).length ? Object.values(certByType).map((c) =>
        `${badge(c.certificationType + (c.isPreapproved ? ' ✓' : ' pending'), c.isPreapproved ? 'b-green' : 'b-yellow')}`).join('') : '<span class="muted">None yet — apply for CONSULTANT, MARKETPLACE_AUTHOR or SECURITY_RESEARCHER (CTO-reviewed, score ≥ 80, valid 90 days).</span>'}</div>
    </div>`;
}

function uiCitation() {
  formModal('Issue code audit citation (৳2,000 fine → ৳1,000 CTO + ৳1,000 reserve)', [
    { name: 'squadId', label: 'Squad', type: 'select', options: S.squads.map((s) => ({ value: s.id, label: s.name })) },
    { name: 'type', label: 'Type', type: 'select', options: ['CODE_SMELL', 'BAD_MERGE_REQUEST', 'SECURITY_VULNERABILITY'].map((t) => ({ value: t, label: t })) },
    { name: 'description', label: 'Description (min 15 chars)', type: 'textarea', required: true, value: 'God class with 14 responsibilities detected in UserService.' },
  ], 'Issue fine', (d) => act('POST', '/cto/citations', d, true));
}

function uiCertApply() {
  formModal('Apply for provider certification', [
    { name: 'certificationType', label: 'Type', type: 'select', options: ['CONSULTANT', 'MARKETPLACE_AUTHOR', 'SECURITY_RESEARCHER'].map((t) => ({ value: t, label: t })) },
    { name: 'portfolioUrl', label: 'Portfolio URL', value: 'https://github.com/' + S.user.email.split('@')[0] },
    { name: 'applicationNotes', label: 'Application notes', type: 'textarea', value: 'Enterprise microservice experience; authored studio CQRS libraries.' },
  ], 'Apply', (d) => act('POST', '/cto/certifications/apply', d));
}

function uiCertReview(id) {
  formModal('Review certification (≥80 approves · <80 = 7-day cooldown)', [
    { name: 'qualityScore', label: 'Score (0-100)', type: 'number', value: 86, required: true },
    { name: 'action', label: 'Action', type: 'select', options: [{ value: 'APPROVE', label: 'APPROVE (needs ≥80)' }, { value: 'REJECT', label: 'REJECT (<80)' }] },
    { name: 'notes', label: 'Review notes', type: 'textarea', value: 'Strong grasp of distributed locking and defensive indexing.' },
  ], 'Submit review', (d) => act('POST', `/cto/certifications/${id}/review`, { ...d, qualityScore: +d.qualityScore }));
}

/* ------------------------------ Bounty ------------------------------ */
async function viewBounty() {
  const [targets, reports] = await Promise.all([api('GET', '/bounty/targets'), api('GET', '/bounty/reports')]);
  tabActions(`<div class="row">
    ${isDev() ? '<button class="btn primary" onclick="uiBugReport()">Submit bug report</button>' : ''}
    ${isCTO() || isPM() ? '<button class="btn" onclick="uiBountyTarget()">Fund target pool</button>' : ''}</div>`);
  C().innerHTML = `
    <div class="panel"><h3>Active targets</h3><table>
      <tr><th>Title</th><th>Target squad</th><th>Pool remaining</th><th>Open bugs</th></tr>
      ${targets.map((t) => `<tr><td>${esc(t.title)}</td><td>${esc(t.targetSquadName)}</td><td class="money">${money(t.remainingPool)} / ${money(t.totalBountyPool)}</td><td>${t.openBugCount}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No targets</td></tr>'}
    </table></div>
    <div class="panel"><h3>Reports</h3><table>
      <tr><th>Title</th><th>Severity</th><th>Status</th><th>Hunter</th><th>Bounty</th>${isCTO() ? '<th>Triage</th>' : ''}</tr>
      ${reports.map((r) => `<tr><td>${esc(r.title)}</td><td>${statusBadge(r.severity)}</td><td>${statusBadge(r.status)}</td>
        <td>${esc(r.reportingUser?.fullName || '')} (${esc(r.reportingSquad?.name || '')})</td><td class="money">${r.bountyAmount ? money(r.bountyAmount) : '—'}</td>
        ${isCTO() ? `<td>${r.status === 'SUBMITTED' ? `<button class="btn good sm" onclick="uiTriage('${r.id}','${r.severity}')">Verify</button> <button class="btn bad sm" onclick="act('POST','/bounty/reports/${r.id}/triage',{action:'REJECT',notes:'Not reproducible'})">Reject</button>` : '—'}</td>` : ''}
      </tr>`).join('') || '<tr><td colspan="6" class="empty">No reports</td></tr>'}
    </table></div>`;
}

function uiBountyTarget() {
  const opts = isPM() ? mySquads() : S.squads;
  formModal('Fund bounty target (escrow from squad treasury)', [
    { name: 'title', label: 'Title', required: true, value: 'Hardening target' },
    { name: 'targetSquadId', label: 'Target squad', type: 'select', options: opts.map((s) => ({ value: s.id, label: s.name })) },
    { name: 'totalBountyPool', label: 'Pool (min 5000)', type: 'number', value: 10000, required: true },
  ], 'Fund', (d) => act('POST', '/bounty/targets', { ...d, totalBountyPool: +d.totalBountyPool }));
}

function uiBugReport() {
  api('GET', '/bounty/targets').then((targets) => {
    const active = targets.filter((t) => t.isActive);
    formModal('Submit bug report (cross-squad only)', [
      { name: 'bountyTargetId', label: 'Target', type: 'select', options: active.map((t) => ({ value: t.id, label: `${t.title} — ${t.targetSquadName} (pool ${t.remainingPool})` })) },
      { name: 'title', label: 'Title', required: true },
      { name: 'severity', label: 'Severity', type: 'select', options: ['CRITICAL', 'MAJOR', 'MINOR', 'LOW'].map((s) => ({ value: s, label: `${s} (${({ CRITICAL: 5000, MAJOR: 3000, MINOR: 1000, LOW: 500 })[s]})` })) },
      { name: 'description', label: 'Description (min 20 chars)', type: 'textarea', required: true },
      { name: 'reproductionSteps', label: 'Reproduction steps (min 30 chars)', type: 'textarea', required: true, value: "1. Send GET to /api/search?q=' OR 1=1--\n2. Observe database dump in response." },
    ], 'Submit', async (d) => {
      const target = active.find((t) => t.id === d.bountyTargetId);
      await api('POST', '/bounty/reports', { ...d, targetSquadId: target.targetSquadId });
    });
  });
}

function uiTriage(id, severity) {
  formModal('Verify & pay bounty', [
    { name: 'severity', label: 'Severity', type: 'select', value: severity, options: ['CRITICAL', 'MAJOR', 'MINOR', 'LOW'].map((s) => ({ value: s, label: s })) },
    { name: 'notes', label: 'Notes', type: 'textarea', value: 'Verified in staging replica.' },
  ], 'Verify & pay', (d) => act('POST', `/bounty/reports/${id}/triage`, { action: 'VERIFY', severity: d.severity, notes: d.notes }));
}

/* ------------------------------ Clients ------------------------------ */
async function viewClients() {
  let contracts = [];
  try { contracts = await api('GET', '/clients/contracts'); } catch { /* */ }
  tabActions(isExec() ? '<button class="btn primary" onclick="uiNewClient()">+ New client</button>' : '');
  C().innerHTML = contracts.map((c) => `
    <div class="panel"><h3>${esc(c.title)} ${statusBadge(c.status)} <span class="muted" style="font-weight:400;font-size:12px">${esc(c.client?.companyName || '')}</span></h3>
      <div class="cards" style="margin-bottom:10px">
        <div class="card"><div class="k">Contract value</div><div class="v money">${money(c.totalValue)}</div></div>
        <div class="card"><div class="k">Escrow balance</div><div class="v">${money(c.escrowBalance)}</div></div>
      </div>
      <table><tr><th>Milestone</th><th>Squad</th><th>Payout</th><th>Status</th><th>Actions</th></tr>
        ${c.milestones.map((m) => `<tr><td>${esc(m.milestoneName)}</td><td>${esc(m.assignedSquad?.name || '—')}</td><td class="money">${money(m.payoutAmount)}</td><td>${statusBadge(m.status)}</td>
          <td class="row">
            ${isExec() && m.status === 'PENDING' ? `<button class="btn sm" onclick="uiMilestone('${c.id}')">+ Milestone</button>
              <button class="btn sm" onclick="uiEscrow('${m.id}')">Fund escrow</button>` : ''}
            ${(isExec() || isPM()) && m.status === 'PENDING' ? `<button class="btn sm" onclick="uiAssign('${m.id}')">Assign squad</button>` : ''}
            ${m.status === 'IN_PROGRESS' && isCTO() ? `<button class="btn good sm" onclick="act('POST','/clients/milestones/${m.id}/cto-audit',{pass:true})">CTO pass</button>
              <button class="btn bad sm" onclick="act('POST','/clients/milestones/${m.id}/cto-audit',{pass:false})">CTO fail</button>` : ''}
            ${m.status === 'CLIENT_REVIEW' && (isPM() || isCEO() || isCPO()) ? `<button class="btn good sm" onclick="act('POST','/clients/milestones/${m.id}/client-accept',{accepted:true},true)">Client accepts</button>
              <button class="btn bad sm" onclick="act('POST','/clients/milestones/${m.id}/client-accept',{accepted:false})">Dispute</button>` : ''}
          </td></tr>`).join('') || '<tr><td colspan="5" class="empty">No milestones</td></tr>'}
      </table></div>`).join('') || '<div class="panel empty">No contracts yet</div>';
}

function uiNewClient() {
  formModal('New client', [
    { name: 'companyName', label: 'Company', required: true, placeholder: 'Acme Retail Ltd.' },
    { name: 'contactName', label: 'Contact name', placeholder: 'Jane Chowdhury' },
    { name: 'contactEmail', label: 'Contact email', required: true, placeholder: 'jane@acme.example' },
  ], 'Create client', async (d) => {
    const client = await api('POST', '/clients', d);
    formModal('New contract (splits must total 100%)', [
      { name: 'clientId', label: 'Client', type: 'select', value: client.id, options: [{ value: client.id, label: client.companyName }] },
      { name: 'title', label: 'Contract title', required: true, placeholder: 'Retail POS Platform' },
      { name: 'contractType', label: 'Type', type: 'select', options: ['FIXED_BID', 'TIME_AND_MATERIALS', 'RETAINER'].map((t) => ({ value: t, label: t })) },
      { name: 'totalValue', label: 'Total value (BDT)', type: 'number', value: 200000, required: true },
    ], 'Create contract', (d2) => act('POST', '/clients/contracts', { ...d2, totalValue: +d2.totalValue }));
  });
}

function uiMilestone(contractId) {
  formModal('Add milestone', [
    { name: 'contractId', label: 'Contract', type: 'select', value: contractId, options: [{ value: contractId, label: 'this contract' }] },
    { name: 'milestoneName', label: 'Milestone name', required: true, placeholder: 'MVP checkout flow' },
    { name: 'payoutAmount', label: 'Payout (BDT)', type: 'number', value: 80000, required: true },
  ], 'Add', (d) => act('POST', '/clients/milestones', { ...d, payoutAmount: +d.payoutAmount }));
}

function uiEscrow(milestoneId) {
  formModal('Fund milestone escrow (client deposit)', [
    { name: 'amount', label: 'Amount (BDT)', type: 'number', value: 80000, required: true },
  ], 'Fund', (d) => act('POST', `/clients/milestones/${milestoneId}/escrow`, { amount: +d.amount }, true));
}

function uiAssign(milestoneId) {
  formModal('Assign squad', [
    { name: 'squadId', label: 'Squad', type: 'select', options: S.squads.map((s) => ({ value: s.id, label: s.name })) },
  ], 'Assign', (d) => act('POST', `/clients/milestones/${milestoneId}/assign`, d));
}

/* ------------------------------ Notices ------------------------------ */
async function viewNotices() {
  const notices = await api('GET', '/notices');
  tabActions(isCPO() || isCEO() ? '<button class="btn primary" onclick="uiNoticeDispatch()">Dispatch notice</button>' : '');
  C().innerHTML = notices.map((n) => `<div class="list-item"><div class="top">
    <div><b>${esc(n.title)}</b> ${badge(n.category, n.category === 'DISCIPLINARY' ? 'b-red' : 'b-blue')}</div>
    <div class="row">${statusBadge(n.status)}
      ${n.status !== 'ACKNOWLEDGED' ? `<button class="btn good sm" onclick="uiAck('${n.id}')">Acknowledge</button>` : ''}
      <button class="btn sm" onclick="uiDecrypt('${esc(n.encryptedContent)}')">Decrypt</button>
    </div></div>
    <div class="muted" style="font-size:12px;margin-top:4px">From ${esc(n.sender?.fullName || '')} · ${dt(n.createdAt)}</div>
  </div>`).join('') || '<div class="panel empty">Inbox empty</div>';
}

function uiAck(id) {
  formModal('Sign acknowledgment', [
    { name: 'acknowledgmentSignature', label: 'ACK signature', value: btoa('ack-' + S.user.id + '-' + Date.now()) },
  ], 'Sign', (d) => act('POST', `/notices/${id}/acknowledge`, d));
}

function uiDecrypt(cipher) {
  let text = cipher;
  try { text = atob(cipher); } catch { /* not base64 */ }
  openModal('Decrypted notice (client-side)', `<div style="padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--panel2)">${esc(text)}</div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button></div>`);
}

async function uiNoticeDispatch() {
  let users = [];
  try { users = await api('GET', '/users'); } catch { /* */ }
  formModal('Dispatch encrypted notice', [
    { name: 'recipientId', label: 'Recipient', type: 'select', options: users.map((u) => ({ value: u.id, label: `${u.fullName} (${u.role})` })) },
    { name: 'category', label: 'Category', type: 'select', options: ['DISCIPLINARY', 'APPOINTMENT', 'ORGANIZATIONAL', 'STUDIO_DIRECTIVE'].map((c) => ({ value: c, label: c })) },
    { name: 'title', label: 'Title', required: true, value: 'Disciplinary citation' },
    { name: 'message', label: 'Message (encrypted client-side with recipient public key — demo: base64)', type: 'textarea', required: true, value: 'Your lab attendance and commit activity require immediate improvement.' },
  ], 'Encrypt & dispatch', (d) => {
    const { message, ...rest } = d;
    return act('POST', '/notices', {
      ...rest,
      encryptedContent: btoa(unescape(encodeURIComponent(message))),
      signature: btoa('ed25519-sig-' + Date.now()),
    });
  });
}

/* ------------------------------ Chaos ------------------------------ */
async function viewChaos() {
  const events = await api('GET', '/chaos/events?includeResolved=true');
  tabActions(isCEO() ? '<button class="btn bad" onclick="uiChaosTrigger()">⚡ Trigger chaos</button>' : '');
  C().innerHTML = events.map((e) => `<div class="list-item"><div class="top">
    <div><b>${esc(e.title)}</b> ${badge(e.type, 'b-red')} ${e.resolvedAt ? badge('RESOLVED', 'b-green') : badge('OPEN', 'b-yellow')}</div>
    ${!e.resolvedAt ? `<button class="btn good sm" onclick="uiChaosResolve('${e.id}')">Resolve</button>` : ''}
  </div>
    <div class="muted" style="font-size:12.5px;margin-top:4px">${esc(e.description)}</div>
    <div class="muted" style="font-size:12px;margin-top:2px">Target: ${esc(e.targetSquad?.name || e.targetUser?.fullName || 'studio-wide')} ·
      ${e.penaltyAmount ? 'Penalty ' + money(e.penaltyAmount) : 'no penalty'} ${e.penaltyAppliedAt ? '· <span style="color:var(--danger)">penalty applied</span>' : ''} · ${dt(e.createdAt)}</div>
    ${e.resolution ? `<div style="font-size:12.5px;margin-top:4px;color:var(--accent2)">✔ ${esc(e.resolution)}</div>` : ''}
  </div>`).join('') || '<div class="panel empty">No incidents — studio is calm</div>';
}

function uiChaosTrigger() {
  formModal('⚡ Inject chaos event', [
    { name: 'type', label: 'Type', type: 'select', options: [
      { value: 'SERVER_OUTAGE', label: 'SERVER_OUTAGE (timed penalty)' },
      { value: 'SCOPE_CREEP', label: 'SCOPE_CREEP' },
      { value: 'LEAD_DEV_SICK_LEAVE', label: 'LEAD_DEV_SICK_LEAVE (30-min lockout)' },
      { value: 'CUSTOM', label: 'CUSTOM' }] },
    { name: 'title', label: 'Title', required: true, value: 'Production database failure' },
    { name: 'description', label: 'Description', type: 'textarea', required: true, value: 'Primary PostgreSQL node crashed. Restore within 10 minutes or pay the fine.' },
    { name: 'targetSquadId', label: 'Target squad', type: 'select', options: [{ value: '', label: '— studio-wide —' }, ...S.squads.map((s) => ({ value: s.id, label: s.name }))] },
    { name: 'penaltyAmount', label: 'Penalty (BDT, optional)', type: 'number', value: 5000 },
    { name: 'timeLimitSeconds', label: 'Time limit (seconds, min 10)', type: 'number', value: 600 },
  ], 'Trigger', (d) => act('POST', '/chaos/events', {
    type: d.type, title: d.title, description: d.description,
    targetSquadId: d.targetSquadId || undefined,
    penaltyAmount: +d.penaltyAmount || undefined,
    timeLimitSeconds: +d.timeLimitSeconds || undefined,
  }));
}

function uiChaosResolve(id) {
  formModal('Resolve incident', [
    { name: 'resolution', label: 'Resolution', type: 'textarea', required: true, value: 'Failed over to replica; service restored.' },
  ], 'Resolve', (d) => act('POST', `/chaos/events/${id}/resolve`, d));
}

/* ------------------------------ Leaderboard ------------------------------ */
async function viewLeaderboard() {
  const lb = await api('GET', '/simulation-scores');
  C().innerHTML = `
    <div class="panel"><h3>Squad leaderboard</h3><table>
      <tr><th>#</th><th>Squad</th><th>Valuation</th><th>Health</th></tr>
      ${lb.squadLeaderboard.map((s) => `<tr><td>${s.rank}</td><td><b>${esc(s.squadName)}</b></td><td class="money">${money(s.valuation)}</td><td class="health-${s.healthStatus}">${statusBadge(s.healthStatus)}</td></tr>`).join('')}
    </table></div>
    <div class="panel"><h3>Student scores</h3><table>
      <tr><th>#</th><th>Student</th><th>Role</th><th>Wallet</th><th>Squad valuation</th><th>Score</th></tr>
      ${lb.studentScores.slice(0, 15).map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.fullName)}</td><td>${badge(s.role, 'b-gray')}</td><td class="money">${money(s.walletBalance)}</td><td>${money(s.squadValuation)}</td><td><b>${s.simulationScore}</b></td></tr>`).join('')}
    </table></div>`;
}

/* ------------------------------ Settings ------------------------------ */
async function viewSettings() {
  const settings = await api('GET', '/settings');
  C().innerHTML = `<div class="panel"><table><tr><th>Key</th><th>Type</th><th>Value</th><th></th></tr>
    ${settings.map((s) => `<tr><td class="mono">${esc(s.key)}</td><td>${badge(s.type, 'b-gray')}</td>
      <td><input class="inp" id="set-${esc(s.key)}" value="${esc(s.value)}" style="width:220px"/></td>
      <td><button class="btn sm" onclick="uiSaveSetting('${esc(s.key)}','${esc(s.type)}')">Save</button></td></tr>`).join('')}
  </table></div>`;
}

async function uiSaveSetting(key, type) {
  const value = document.getElementById('set-' + key).value;
  try { await api('PUT', '/settings', { key, value, type }); toast('Saved'); } catch (e) { toast(e.message, false); }
}

/* ============================== boot ============================== */
async function boot() {
  try {
    S.user = await api('GET', '/auth/me');
    renderShell();
    await render();
  } catch (e) {
    doLogout(false);
    loginView(e.message || 'Session expired');
  }
}

(async function init() {
  const saved = localStorage.getItem('pf_session');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      S.token = s.token; S.refreshToken = s.refreshToken;
      await boot();
      return;
    } catch { /* fallthrough */ }
  }
  loginView();
})();
