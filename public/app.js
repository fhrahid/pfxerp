/* Pointfex ERP — v1 test console (vanilla JS, no build step) */
'use strict';

const API = '/api/v1';
const S = { token: null, refreshToken: null, user: null, tab: 'overview', squads: [] };

const EXEC = ['CEO', 'CFO', 'CTO', 'CPO'];
const isExec = () => EXEC.includes(S.user?.role);
const isCEO = () => S.user?.role === 'CEO';
const isCFO = () => S.user?.role === 'CFO';
const isCTO = () => S.user?.role === 'CTO';
const isCPO = () => S.user?.role === 'CPO';
const isPM = () => S.user?.role === 'PM';
const isDev = () => S.user?.role === 'DEVELOPER';
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

function saveSession() {
  localStorage.setItem('pf_session', JSON.stringify({ token: S.token, refreshToken: S.refreshToken }));
}
function clearSession() { localStorage.removeItem('pf_session'); }

/* ---------- modal ---------- */
function openModal(title, html) {
  document.getElementById('modal-root').innerHTML =
    `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal"><h3>${esc(title)}</h3>${html}</div></div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

function formModal(title, fields, submitLabel, onSubmit) {
  const body = fields.map((f) => {
    const req = f.required ? 'required' : '';
    if (f.type === 'select') {
      const opts = f.options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(f.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
      return `<label>${esc(f.label)}<select name="${f.name}" ${req}>${opts}</select></label>`;
    }
    if (f.type === 'textarea') return `<label>${esc(f.label)}<textarea name="${f.name}" rows="3" ${req}>${esc(f.value || '')}</textarea></label>`;
    if (f.type === 'datetime') return `<label>${esc(f.label)}<input type="datetime-local" name="${f.name}" value="${esc(f.value || '')}" ${req}/></label>`;
    if (f.type === 'number') return `<label>${esc(f.label)}<input type="number" name="${f.name}" value="${f.value ?? ''}" step="${f.step || '1'}" ${req}/></label>`;
    if (f.type === 'checkbox') return `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="${f.name}" style="width:auto;margin:0" ${f.value ? 'checked' : ''}/> ${esc(f.label)}</label>`;
    return `<label>${esc(f.label)}<input type="text" name="${f.name}" value="${esc(f.value ?? '')}" ${req}/></label>`;
  }).join('');
  openModal(title, `<form id="mform">${body}
    <div class="modal-actions">
      <button type="button" class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn primary" type="submit">${esc(submitLabel)}</button>
    </div></form>`);
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
    BACKLOG: 'b-gray', TODO: 'b-gray', IN_PROGRESS: 'b-blue', FLAGGED_COMPLETE: 'b-yellow', PM_VERIFIED: 'b-yellow', CTO_VERIFIED: 'b-green', CLOSED: 'b-green',
    HIGH: 'b-yellow', PENDING: 'b-gray', IN_PROGRESS2: 'b-blue', CLIENT_REVIEW: 'b-yellow', PAID: 'b-green',
  };
  return badge(s, map[s] || 'b-gray');
};

async function loadSquads() {
  try { S.squads = await api('GET', '/squads'); } catch { S.squads = []; }
  return S.squads;
}
const squadName = (id) => S.squads.find((s) => s.id === id)?.name || id?.slice(0, 8) || '—';

/* ============================== login ============================== */
function loginView(msg) {
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      <h1>POINT<span style="color:var(--accent)">FEX</span> ERP</h1>
      <p class="slogan">"From an idea to a greater impact" — Venture Studio Console</p>
      ${msg ? `<p style="color:var(--danger);font-size:12.5px">${esc(msg)}</p>` : ''}
      <form id="login-form">
        <label>Email<input name="email" type="email" required placeholder="noor@seu.edu.bd" style="margin-top:4px"/></label>
        <label style="margin-top:10px">Password<input name="password" type="password" required style="margin-top:4px"/></label>
        <button class="btn primary" style="width:100%;justify-content:center;margin-top:16px" type="submit">Sign in</button>
      </form>
      <p class="muted" style="font-size:11.5px;margin-top:14px">Seeded: noor@seu.edu.bd · cfo/cto/cpo@pointfex.dev · pm1..pm6 · dev{squad}_{1..4} @pointfex.dev</p>
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
  const rt = S.refreshToken;
  S.token = S.refreshToken = S.user = null;
  clearSession();
  if (rt) fetch(API + '/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('dead') || '' } }).catch(() => {});
  if (redirect) loginView();
}

/* ============================== shell ============================== */
const TABS = [
  { id: 'overview', label: 'Overview', show: () => true },
  { id: 'kanban', label: 'Tasks', show: () => true },
  { id: 'squads', label: 'Squads', show: () => true },
  { id: 'payroll', label: 'Payroll', show: () => isPM() || isCPO() || isCEO() },
  { id: 'finance', label: 'Finance', show: () => isExec() || isPM() },
  { id: 'governance', label: 'Governance', show: () => isExec() },
  { id: 'bounty', label: 'Bug Bounty', show: () => true },
  { id: 'cto', label: 'CTO Tools', show: () => true },
  { id: 'clients', label: 'Clients', show: () => isExec() || isPM() },
  { id: 'notices', label: 'Notices', show: () => true },
  { id: 'chaos', label: 'Chaos', show: () => isCEO() || isPM() },
  { id: 'leaderboard', label: 'Leaderboard', show: () => true },
  { id: 'users', label: 'Roster', show: () => isExec() },
  { id: 'settings', label: 'Settings', show: () => isCEO() },
];

function renderShell() {
  const u = S.user;
  const tabs = TABS.filter((t) => t.show());
  document.getElementById('app').innerHTML = `
    <nav class="sidebar">
      <div class="brand">POINT<span>FEX</span></div>
      ${tabs.map((t) => `<a class="nav-btn ${S.tab === t.id ? 'active' : ''}" data-tab="${t.id}" href="#" onclick="event.preventDefault();setTab('${t.id}')">${t.label}</a>`).join('')}
      <div class="spacer"></div>
      <div class="userbox">
        <div class="name">${esc(u.fullName)}</div>
        <div class="role">${esc(u.role)}${u.tier ? ' · ' + esc(u.tier) : ''}</div>
        <div style="margin-top:6px" class="money">${money(u.walletBalance)}</div>
        <button class="btn sm ghost" style="margin-top:8px" onclick="logoutClick()">Log out</button>
      </div>
    </nav>
    <main class="main" id="content"></main>`;
}
function logoutClick() {
  const t = S.token;
  if (t) fetch(API + '/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' } }).catch(() => {});
  doLogout();
}
function setTab(id) { S.tab = id; renderShell(); render(); }
const C = () => document.getElementById('content');

async function render() {
  if (!S.user) return;
  const views = {
    overview: viewOverview, kanban: viewKanban, squads: viewSquads, payroll: viewPayroll,
    finance: viewFinance, governance: viewGovernance, bounty: viewBounty, cto: viewCto,
    clients: viewClients, notices: viewNotices, chaos: viewChaos, leaderboard: viewLeaderboard,
    users: viewUsers, settings: viewSettings,
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
    noticesHtml = `<div class="panel"><h3>Recent notices <span class="muted">(${unread} awaiting acknowledgment)</span></h3>
      ${notices.slice(0, 4).map((n) => `<div class="list-item"><div class="top"><b>${esc(n.title)}</b>${statusBadge(n.status)}</div>
        <div class="muted" style="font-size:12px;margin-top:4px">${esc(n.category)} · from ${esc(n.sender?.fullName || '')} · ${dt(n.createdAt)}</div></div>`).join('') || '<div class="empty">No notices</div>'}</div>`;
  } catch { /* 403 for some roles */ }
  C().innerHTML = `
    <div class="page-head"><div><h2>Welcome back, ${esc(S.user.fullName.split(' ')[0])}</h2>
      <div class="sub">${esc(S.user.role)} · ${mySquads().length ? 'Squad: ' + esc(mySquads().map((s) => s.name).join(', ')) : 'Executive board'}</div></div></div>
    <div class="cards">
      <div class="card"><div class="k">My Wallet</div><div class="v money">${money(me.walletBalance)}</div></div>
      <div class="card"><div class="k">Open Tasks</div><div class="v">${me.openTasks ?? 0}</div></div>
      <div class="card"><div class="k">Latest DPI</div><div class="v">${me.latestDpi ?? '—'}</div></div>
    </div>
    ${me.squads?.length ? `<div class="panel"><h3>My squads</h3><table><tr><th>Squad</th><th>Treasury</th><th>Health</th></tr>
      ${me.squads.map((s) => `<tr><td>${esc(s.name)}</td><td class="money">${money(s.balance)}</td><td class="health-${s.health}">${statusBadge(s.health)}</td></tr>`).join('')}</table></div>` : ''}
    ${noticesHtml}`;
}

/* ------------------------------ Kanban ------------------------------ */
const KANBAN_COLS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'FLAGGED_COMPLETE', 'PM_VERIFIED', 'CTO_VERIFIED', 'CLOSED'];

async function viewKanban() {
  const squadOpts = isExec() ? S.squads : mySquads();
  if (!squadOpts.length) { C().innerHTML = '<div class="panel empty">No squad membership</div>'; return; }
  if (!S.kanbanSquad || !squadOpts.find((s) => s.id === S.kanbanSquad)) S.kanbanSquad = squadOpts[0].id;
  const tasks = await api('GET', '/tasks?squadId=' + S.kanbanSquad);
  const byStatus = {};
  KANBAN_COLS.forEach((c) => (byStatus[c] = []));
  tasks.forEach((t) => (byStatus[t.status] || (byStatus[t.status] = [])).push(t));

  C().innerHTML = `
    <div class="page-head"><div><h2>Task Board</h2><div class="sub">Anti-gaming state machine — git proof, PM gate, CTO gate</div></div>
      <div class="row">
        <select class="inp" id="kanban-squad" onchange="S.kanbanSquad=this.value;render()">
          ${squadOpts.map((s) => `<option value="${s.id}" ${s.id === S.kanbanSquad ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
        ${isPM() || isExec() ? `<button class="btn primary" onclick="uiCreateTask()">+ New task</button>` : ''}
      </div></div>
    <div class="kanban">${KANBAN_COLS.map((col) => `
      <div class="kcol"><h4><span>${col.replace('_', ' ')}</span><span>${byStatus[col].length}</span></h4>
        ${byStatus[col].map((t) => `
          <div class="kcard" onclick="uiTaskDetail('${t.id}')">
            <div class="t">${esc(t.title)}</div>
            <div class="m"><span>${t.storyPoints} pts</span><span>${esc(t.priority)}</span></div>
            <div class="m"><span>${esc(t.assignedTo?.fullName || 'unassigned')}</span></div>
          </div>`).join('') || '<div class="muted" style="font-size:11.5px;padding:6px 2px">—</div>'}
      </div>`).join('')}
    </div>`;
}

function uiCreateTask() {
  const squadOpts = isExec() ? S.squads : mySquads();
  formModal('Create task', [
    { name: 'squadId', label: 'Squad', type: 'select', options: squadOpts.map((s) => ({ value: s.id, label: s.name })), required: true },
    { name: 'title', label: 'Title', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'storyPoints', label: 'Story points (1-13)', type: 'number', value: 3, min: 1, required: true },
    { name: 'priority', label: 'Priority', type: 'select', options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => ({ value: p, label: p })), value: 'MEDIUM' },
    { name: 'sprintNumber', label: 'Sprint number', type: 'number', value: 1 },
  ], 'Create', async (d) => {
    d.storyPoints = +d.storyPoints; d.sprintNumber = +d.sprintNumber || undefined;
    const members = await api('GET', '/squads/' + d.squadId);
    const devOpts = members.members.filter((m) => m.role === 'DEVELOPER').map((m) => ({ value: m.userId, label: m.fullName + ' (' + (m.tier || '') + ')' }));
    if (devOpts.length) {
      // second step: assignee (moves task straight to TODO)
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

  openModal('Task · ' + esc(t.title), `
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

/* ------------------------------ Squads ------------------------------ */
async function viewSquads() {
  C().innerHTML = `<div class="page-head"><div><h2>Squads</h2><div class="sub">Dynamic roster · elastic headcount · fractional allocation</div></div>
    ${isCPO() || isCEO() ? '<button class="btn primary" onclick="uiTransferMember()">Transfer member</button>' : ''}</div>
    <div class="panel"><table>
      <tr><th>Squad</th><th>Members</th><th>Treasury</th><th>Valuation</th><th>Health</th><th>Tasks</th></tr>
      ${S.squads.map((s) => `<tr onclick="uiSquadDetail('${s.id}')" style="cursor:pointer">
        <td><b>${esc(s.name)}</b></td><td>${s.memberCount}</td><td class="money">${money(s.balance)}</td>
        <td>${money(s.valuation)}</td><td class="health-${s.health}">${statusBadge(s.health)}</td><td>${s.taskCount}</td></tr>`).join('')}
    </table></div>`;
}

async function uiSquadDetail(id) {
  const s = await api('GET', '/squads/' + id);
  openModal('Squad · ' + esc(s.name), `
    <div class="pillrow" style="margin-bottom:10px">${statusBadge(s.health)} <span class="badge b-gold">${money(s.balance)}</span> <span class="badge b-blue">valuation ${money(s.valuation)}</span></div>
    <table><tr><th>Member</th><th>Role</th><th>Tier</th><th>Allocation</th></tr>
      ${s.members.map((m) => `<tr><td>${esc(m.fullName)}</td><td>${statusBadge(m.role)}</td><td>${esc(m.tier || '—')}</td><td>${(Number(m.allocation) * 100).toFixed(0)}%</td></tr>`).join('')}
    </table>`);
}

function uiTransferMember() {
  const all = S.squads;
  formModal('Transfer member (৳5,000 fee to destination squad)', [
    { name: 'userId', label: 'User ID', required: true, value: '' },
    { name: 'fromSquadId', label: 'From squad', type: 'select', options: all.map((s) => ({ value: s.id, label: s.name })) },
    { name: 'toSquadId', label: 'To squad', type: 'select', options: all.map((s) => ({ value: s.id, label: s.name })) },
  ], 'Transfer', (d) => act('POST', '/squads/members/transfer', d, true));
}

/* ------------------------------ Payroll ------------------------------ */
const TIER_CAPS = { STAR_PERFORMER: 3500, REGULAR: 2000, UNDERPERFORMER: 1000, SLACKER: 0 };

async function viewPayroll() {
  const status = S.payrollStatus || 'SUBMITTED';
  const proposals = await api('GET', '/payroll' + (isCPO() || isCEO() ? '?status=' + status : ''));
  C().innerHTML = `
    <div class="page-head"><div><h2>Weekly Lab Payroll</h2><div class="sub">PM proposes ≤ ৳10,000 · CHRO audits & disburses</div></div>
      <div class="row">
        ${isCPO() || isCEO() ? `<select class="inp" onchange="S.payrollStatus=this.value;render()">
          ${['SUBMITTED', 'APPROVED', 'REJECTED'].map((s) => `<option ${s === status ? 'selected' : ''}>${s}</option>`).join('')}</select>` : ''}
        ${isPM() ? '<button class="btn primary" onclick="uiPayrollSubmit()">+ New proposal</button>' : ''}
        ${isCPO() ? '<button class="btn bad" onclick="uiSlackerFine()">Issue slacker fine</button>' : ''}
      </div></div>
    ${proposals.length ? proposals.map((p) => `
      <div class="list-item"><div class="top">
        <div><b>${esc(p.squad?.name || '')}</b> · Lab ${p.labNumber} · ${money(p.totalProposed)}</div>
        <div class="row">${statusBadge(p.status)}
          ${isCPO() && p.status === 'SUBMITTED' ? `<button class="btn good sm" onclick="act('POST','/payroll/${p.id}/approve',null,true)">Approve & disburse</button>
            <button class="btn bad sm" onclick="uiPayrollReject('${p.id}')">Reject</button>` : ''}
        </div></div>
        <div class="itemlist">${p.lineItems.map((li) => `<div class="muted" style="font-size:12.5px">${esc(li.user?.fullName || li.userId)} — ${esc(li.tier)} · ${money(li.amount)} <i>${esc(li.justification || '')}</i></div>`).join('')}</div>
      </div>`).join('') : '<div class="panel empty">No proposals</div>'}`;
}

function uiPayrollReject(id) {
  formModal('Reject payroll proposal', [{ name: 'reason', label: 'Reason', type: 'textarea', required: true }], 'Reject', (d) => act('POST', `/payroll/${id}/reject`, d));
}

function uiSlackerFine() {
  formModal('Slacker fine (৳2,000 — ৳500 CPO / ৳1,500 reserve)', [
    { name: 'targetUserId', label: 'Target user ID', required: true },
    { name: 'targetSquadId', label: 'Squad', type: 'select', options: S.squads.map((s) => ({ value: s.id, label: s.name })) },
    { name: 'reason', label: 'Reason', type: 'textarea', required: true, value: 'Zero commits and missed standup this lab.' },
  ], 'Issue fine', (d) => act('POST', '/fines/slacker', d, true));
}

async function uiPayrollSubmit() {
  const squadOpts = mySquads();
  formModal('New payroll proposal — step 1', [
    { name: 'squadId', label: 'Squad', type: 'select', options: squadOpts.map((s) => ({ value: s.id, label: s.name })) },
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
  try { payouts = await api('GET', '/sprint-payouts'); } catch { /* PM allowed */ }
  try { loans = await api('GET', '/loans'); } catch { /* */ }

  if (isCFO() || isCEO()) {
    sections.push(`
      <div class="panel"><h3>Sprint payouts ${isCFO() ? '<button class="btn primary sm" style="float:right" onclick="uiPayoutNew()">New payout</button>' : ''}</h3>
        ${payouts.length ? `<table><tr><th>Sprint</th><th>Status</th><th>Pool</th><th>Actions</th></tr>
          ${payouts.map((p) => `<tr><td>Sprint ${p.sprintNumber}</td><td>${statusBadge(p.status)}</td><td class="money">${money(p.totalPool)}</td>
            <td class="row">${isCEO() && p.status === 'PROPOSED' ? `<button class="btn good sm" onclick="act('POST','/sprint-payouts/${p.id}/ceo-approve')">CEO approve</button>` : ''}
              ${isCFO() && p.status === 'APPROVED' ? `<button class="btn primary sm" onclick="act('POST','/sprint-payouts/${p.id}/execute',null,true)">Execute</button>` : ''}</td></tr>`).join('')}
        </table>` : '<div class="empty">No payouts yet</div>'}</div>`);
  }
  if (isCFO()) {
    try { equity = await api('GET', '/equity'); } catch { /* */ }
    sections.push(`
      <div class="panel"><h3>Venture equity <button class="btn primary sm" style="float:right" onclick="uiEquityInvest()">Invest</button></h3>
        ${equity ? `<div class="muted" style="margin-bottom:8px">Dividends collected: <span class="money">${money(equity.dividendsReceived)}</span></div>
        <table><tr><th>Squad</th><th>Stake</th><th>Invested</th><th>Sprint</th><th>Active</th></tr>
          ${equity.stakes.map((s) => `<tr><td>${esc(s.squad?.name || '')}</td><td>${(Number(s.stakePercent) * 100).toFixed(0)}%</td><td class="money">${money(s.investedAmount)}</td><td>${s.sprintNumber}</td><td>${s.isActive ? '✓' : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No stakes</td></tr>'}
        </table>` : ''}</div>`);
  }

  sections.push(`
    <div class="panel"><h3>Emergency loans ${isPM() ? '<button class="btn primary sm" style="float:right" onclick="uiLoanApply()">Apply</button>' : ''}
      <span class="muted" style="font-size:11.5px">Treasury &lt; ৳15,000 · 15% interest · 2-of-3 board + CEO</span></h3>
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

  C().innerHTML = `<div class="page-head"><div><h2>Finance</h2><div class="sub">Sprint pool ৳150,000 · 5% CFO tax · 15% loan interest · 10% dividends</div></div></div>` + sections.join('');
}

function uiPayoutNew() {
  const rows = [...S.squads].sort((a, b) => b.balance - a.balance).map((s, i) => ({ s, rank: i + 1 }));
  openModal('Sprint payout — rank the squads', `
    <form id="mform3">
      <label>Sprint number<input name="sprintNumber" type="number" value="1" required/></label>
      ${rows.map((r, i) => `<div class="row" style="margin-bottom:6px;justify-content:space-between">
        <span>${esc(r.s.name)} <span class="muted">(bal ${money(r.s.balance)})</span></span>
        <span>Rank <input class="inp rank-input" name="rank${i}" type="number" min="1" max="6" value="${r.rank}"/></span></div>`).join('')}
      <div class="muted" style="font-size:11.5px;margin:8px 0">Distribution: 50k / 35k / 25k / 20k / 15k / 5k (ranks must be unique 1..6; rank 1 at top)</div>
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

  C().innerHTML = `
    <div class="page-head"><div><h2>Governance</h2><div class="sub">2-of-3 board vote → CEO sign-off (BR-CEO-01..06)</div></div>
      ${!isCEO() && isExec() ? '<button class="btn primary" onclick="uiPropose()">+ Propose decision</button>' : ''}
    </div>
    ${decisions.length ? decisions.map((d) => {
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
    }).join('') : '<div class="panel empty">No decisions</div>'}`;
}

function uiPropose() {
  const loanOptions = S._loanOptions || [];
  formModal('Propose board decision', [
    { name: 'title', label: 'Title', required: true },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'category', label: 'Category', type: 'select', options: ['LOAN_APPROVAL', 'SWAP_REQUEST', 'POLICY_CHANGE', 'EMERGENCY_ACTION'].map((c) => ({ value: c, label: c })) },
    { name: 'referenceId', label: 'Linked loan (for LOAN_APPROVAL)', type: 'select', options: [{ value: '', label: '— none —' }, ...loanOptions] },
  ], 'Propose', async (d) => {
    await api('POST', '/governance/decisions', { ...d, referenceId: d.referenceId || undefined });
  });
}

/* ------------------------------ Bounty ------------------------------ */
async function viewBounty() {
  const [targets, reports] = await Promise.all([api('GET', '/bounty/targets'), api('GET', '/bounty/reports')]);
  C().innerHTML = `
    <div class="page-head"><div><h2>Bug Bounty Arena</h2><div class="sub">Cross-squad adversarial QA · escrowed pools · CTO triage</div></div>
      <div class="row">
        ${isDev() ? '<button class="btn primary" onclick="uiBugReport()">Submit bug report</button>' : ''}
        ${isCTO() || isPM() ? '<button class="btn" onclick="uiBountyTarget()">Fund target pool</button>' : ''}
      </div></div>
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
      { name: 'reproductionSteps', label: 'Reproduction steps (min 30 chars)', type: 'textarea', required: true, value: '1. Send GET to /api/search?q=\x27 OR 1=1--\n2. Observe database dump in response.' },
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

/* ------------------------------ CTO tools ------------------------------ */
async function viewCto() {
  let citations = [], certQueue = null, myCerts = [], listings = [], bookings = [], consultants = [];
  try { citations = await api('GET', '/cto/citations?limit=10'); } catch { /* */ }
  try { certQueue = await api('GET', '/cto/certifications/queue'); } catch { /* */ }
  try { myCerts = await api('GET', '/cto/certifications/me'); } catch { /* */ }
  try { listings = await api('GET', '/cto/marketplace/listings'); } catch { /* */ }
  try { bookings = await api('GET', '/cto/consultancy/bookings'); } catch { /* */ }
  try { consultants = await api('GET', '/cto/certifications/consultants'); } catch { /* */ }

  const certByUser = {}; myCerts.forEach((c) => { certByUser[c.certificationType] = c; });
  const canAuthor = isCTO() || certByUser.MARKETPLACE_AUTHOR?.isPreapproved;
  const canConsult = isCTO() || certByUser.CONSULTANT?.isPreapproved;

  S._consultantOptions = consultants.map((c) => ({ value: c.id, label: c.fullName + ' (' + c.role + ')' }));
  C().innerHTML = `
    <div class="page-head"><div><h2>CTO Tools</h2><div class="sub">Citations · certifications · marketplace · consultancy</div></div>
      <div class="row">
        <button class="btn" onclick="uiCertApply()">Apply for certification</button>
        ${isCTO() ? '<button class="btn primary" onclick="uiCitation()">+ Issue citation</button>' : ''}
      </div></div>

    ${isCTO() ? `<div class="panel"><h3>Certification queue (${certQueue?.pendingCount || 0})</h3>
      ${(certQueue?.queue || []).map((c) => `<div class="list-item"><div class="top">
        <div><b>${esc(c.applicantName)}</b> — ${esc(c.certificationType)}</div>
        <button class="btn primary sm" onclick="uiCertReview('${c.id}')">Review & score</button></div>
        <div class="muted" style="font-size:12px;margin-top:4px">${esc(c.portfolioUrl || '')} ${esc(c.applicationNotes || '')}</div></div>`).join('') || '<div class="empty">Queue empty</div>'}</div>` : ''}

    ${isCTO() ? `<div class="panel"><h3>Recent citations</h3><table><tr><th>Squad</th><th>Type</th><th>Fine</th><th>When</th></tr>
      ${(citations.items || []).map((c) => `<tr><td>${esc(c.squad?.name || '')}</td><td>${badge(c.type, 'b-yellow')}</td><td class="money">${money(c.fineAmount)}</td><td class="muted">${dt(c.createdAt)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">None</td></tr>'}</table></div>` : ''}

    <div class="panel"><h3>Marketplace ${canAuthor ? '<button class="btn primary sm" style="float:right" onclick="uiListing()">+ Publish listing</button>' : ''}</h3>
      <table><tr><th>Asset</th><th>Author</th><th>Price</th><th>Sales</th>${isPM() || isExec() ? '<th></th>' : ''}</tr>
      ${listings.map((l) => `<tr><td>${esc(l.title)} ${l.isCtoVerified ? badge('CTO ✓', 'b-green') : ''}</td><td>${esc(l.authorName)}</td><td class="money">${money(l.price)}</td><td>${l.purchaseCount}</td>
        ${isPM() ? `<td><button class="btn sm" onclick="uiPurchase('${l.id}',${Number(l.price)})">Buy for squad</button></td>` : isExec() ? '<td></td>' : ''}</tr>`).join('') || '<tr><td colspan="5" class="empty">No listings</td></tr>'}</table></div>

    <div class="panel"><h3>Paid consultancy (৳4,000 / 15 min — 50/50 split) ${isPM() ? '<button class="btn primary sm" style="float:right" onclick="uiConsultBook()">Book session</button>' : ''}</h3>
      <table><tr><th>Consultant</th><th>Client squad</th><th>Scheduled</th><th>Status</th><th>Actions</th></tr>
      ${bookings.map((b) => `<tr><td>${esc(b.consultant?.fullName || '')}</td><td>${esc(b.clientSquad?.name || '')}</td><td class="muted">${dt(b.scheduledAt)}</td><td>${statusBadge(b.status)}</td>
        <td class="row">${b.status === 'SCHEDULED' && b.consultantId === S.user.id ? `<button class="btn good sm" onclick="uiConsultComplete('${b.id}')">Complete</button>` : ''}
          ${b.status === 'SCHEDULED' && isPM() ? `<button class="btn bad sm" onclick="act('POST','/cto/consultancy/bookings/${b.id}/cancel')">Cancel</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No bookings</td></tr>'}</table></div>

    <div class="panel"><h3>My certifications</h3>
      <div class="pillrow">${Object.values(certByUser).length ? Object.values(certByUser).map((c) =>
        `${badge(c.certificationType + (c.isPreapproved ? ' ✓' : ' pending'), c.isPreapproved ? 'b-green' : 'b-yellow')}`).join('') : '<span class="muted">None — apply above</span>'}</div>
      ${canConsult ? '<div class="muted" style="margin-top:8px;font-size:12px">You are a certified consultant — you can complete sessions assigned to you.</div>' : ''}
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
    { name: 'applicationNotes', label: 'Application notes', type: 'textarea', value: '8 years of enterprise microservice experience; authored studio CQRS libraries.' },
  ], 'Apply', (d) => act('POST', '/cto/certifications/apply', d));
}

function uiCertReview(id) {
  formModal('Review certification (≥80 approves · <80 = 7-day cooldown)', [
    { name: 'qualityScore', label: 'Score (0-100)', type: 'number', value: 86, required: true },
    { name: 'action', label: 'Action', type: 'select', options: [{ value: 'APPROVE', label: 'APPROVE (needs ≥80)' }, { value: 'REJECT', label: 'REJECT (<80)' }] },
    { name: 'notes', label: 'Review notes', type: 'textarea', value: 'Strong grasp of distributed locking and defensive indexing.' },
  ], 'Submit review', (d) => act('POST', `/cto/certifications/${id}/review`, { ...d, qualityScore: +d.qualityScore }));
}

function uiListing() {
  formModal('Publish marketplace listing', [
    { name: 'title', label: 'Title', required: true, value: 'Enterprise BullMQ Event Bus Starter' },
    { name: 'price', label: 'Price (BDT)', type: 'number', value: 8000, required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'repositoryUrl', label: 'Repository URL', value: 'https://github.com/pointfex/starter' },
  ], 'Publish', (d) => act('POST', '/cto/marketplace/listings', { ...d, price: +d.price }));
}

function uiPurchase(listingId, price) {
  formModal(`Purchase listing (${money(price)} from squad treasury)`, [
    { name: 'buyerSquadId', label: 'Squad', type: 'select', options: mySquads().map((s) => ({ value: s.id, label: s.name })) },
  ], 'Purchase', (d) => act('POST', `/cto/marketplace/listings/${listingId}/purchase`, d, true));
}

function uiConsultBook() {
  const consultantOptions = S._consultantOptions || [];
  formModal('Book consultancy session (৳4,000 escrow)', [
    { name: 'consultantId', label: 'Consultant', type: 'select', options: consultantOptions },
    { name: 'clientSquadId', label: 'Client squad', type: 'select', options: mySquads().map((s) => ({ value: s.id, label: s.name })) },
    { name: 'scheduledAt', label: 'Scheduled at', type: 'datetime', value: new Date(Date.now() + 864e5).toISOString().slice(0, 16), required: true },
  ], 'Book & escrow', (d) => act('POST', '/cto/consultancy/bookings', d, true));
}

function uiConsultComplete(id) {
  formModal('Complete session (min 50 words + PR link)', [
    { name: 'meetingNotes', label: 'Meeting notes (min 50 words)', type: 'textarea', required: true, value: 'Reviewed Postgres connection pooling strategies and advised migration to PgBouncer; refactored high-latency Prisma raw queries to indexed views; agreed on caching plan for next sprint; discussed retry policies for BullMQ workers and dead-letter handling going forward.' },
    { name: 'prLinks', label: 'PR links (one per line)', type: 'textarea', required: true, value: 'https://github.com/pointfex/squad-1/pull/104' },
  ], 'Complete & settle', (d) => act('POST', `/cto/consultancy/bookings/${id}/complete`, d));
}

/* ------------------------------ Clients ------------------------------ */
async function viewClients() {
  let clients = [], contracts = [];
  try { clients = await api('GET', '/clients'); } catch { /* */ }
  try { contracts = await api('GET', '/clients/contracts'); } catch { /* */ }

  C().innerHTML = `
    <div class="page-head"><div><h2>Real-Client Pipeline</h2><div class="sub">Escrow funding · CTO gate · 25/65/10 revenue waterfall</div></div>
      ${isExec() ? '<button class="btn primary" onclick="uiNewClient()">+ New client</button>' : ''}</div>
    ${contracts.map((c) => `
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
              ${m.status === 'IN_PROGRESS' && isCTO() ? `<button class="btn good sm" onclick="act('POST','/clients/milestones/${m.id}/cto-audit',{pass:true})">CTO pass</button>` : ''}
              ${m.status === 'CLIENT_REVIEW' && (isPM() || isCEO() || isCPO()) ? `<button class="btn good sm" onclick="act('POST','/clients/milestones/${m.id}/client-accept',{accepted:true},true)">Client accepts</button>
                <button class="btn bad sm" onclick="act('POST','/clients/milestones/${m.id}/client-accept',{accepted:false})">Dispute</button>` : ''}
            </td></tr>`).join('') || '<tr><td colspan="5" class="empty">No milestones</td></tr>'}
        </table></div>`).join('') || '<div class="panel empty">No contracts yet</div>'}`;
}

function uiNewClient() {
  formModal('New client', [
    { name: 'companyName', label: 'Company', required: true, value: 'Acme Retail Ltd.' },
    { name: 'contactName', label: 'Contact name', value: 'Jane Chowdhury' },
    { name: 'contactEmail', label: 'Contact email', type: 'text', value: 'jane@acme.example', required: true },
  ], 'Create client', async (d) => {
    const client = await api('POST', '/clients', d);
    formModal('New contract (splits must total 100%)', [
      { name: 'clientId', label: 'Client', type: 'select', value: client.id, options: [{ value: client.id, label: client.companyName }] },
      { name: 'title', label: 'Contract title', required: true, value: 'Retail POS Platform' },
      { name: 'contractType', label: 'Type', type: 'select', options: ['FIXED_BID', 'TIME_AND_MATERIALS', 'RETAINER'].map((t) => ({ value: t, label: t })) },
      { name: 'totalValue', label: 'Total value (BDT)', type: 'number', value: 200000, required: true },
    ], 'Create contract', (d2) => act('POST', '/clients/contracts', { ...d2, totalValue: +d2.totalValue }));
  });
}

function uiMilestone(contractId) {
  formModal('Add milestone', [
    { name: 'contractId', label: 'Contract', type: 'select', value: contractId, options: [{ value: contractId, label: 'this contract' }] },
    { name: 'milestoneName', label: 'Milestone name', required: true, value: 'MVP checkout flow' },
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
  C().innerHTML = `
    <div class="page-head"><div><h2>Secure Notices (E2EE)</h2><div class="sub">Server stores ciphertext + signatures only — zero knowledge</div></div>
      ${isCPO() || isCEO() ? '<button class="btn primary" onclick="uiNoticeDispatch()">Dispatch notice</button>' : ''}</div>
    ${notices.map((n) => `<div class="list-item"><div class="top">
      <div><b>${esc(n.title)}</b> ${badge(n.category, n.category === 'DISCIPLINARY' ? 'b-red' : 'b-blue')}</div>
      <div class="row">${statusBadge(n.status)}
        ${n.status !== 'ACKNOWLEDGED' ? `<button class="btn good sm" onclick="uiAck('${n.id}')">Acknowledge</button>
          <button class="btn sm" onclick="uiDecrypt('${esc(n.encryptedContent)}')">Decrypt</button>` : `<button class="btn sm" onclick="uiDecrypt('${esc(n.encryptedContent)}')">Decrypt</button>`}
      </div></div>
      <div class="muted" style="font-size:12px;margin-top:4px">From ${esc(n.sender?.fullName || '')} · ${dt(n.createdAt)}</div>
    </div>`).join('') || '<div class="panel empty">Inbox empty</div>'}`;
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
      encryptedContent: btoa(unescape(encodeURIComponent(message))), // demo stand-in for AES-256-GCM
      signature: btoa('ed25519-sig-' + Date.now()),                  // demo stand-in for Ed25519
    });
  });
}

/* ------------------------------ Chaos ------------------------------ */
async function viewChaos() {
  const events = await api('GET', '/chaos/events?includeResolved=true');
  C().innerHTML = `
    <div class="page-head"><div><h2>Chaos Console</h2><div class="sub">${isCEO() ? 'Inject live lab crises' : 'Resolve your squad\'s incidents'}</div></div>
      ${isCEO() ? '<button class="btn bad" onclick="uiChaosTrigger()">⚡ Trigger chaos</button>' : ''}</div>
    ${events.map((e) => `<div class="list-item"><div class="top">
      <div><b>${esc(e.title)}</b> ${badge(e.type, 'b-red')} ${e.resolvedAt ? badge('RESOLVED', 'b-green') : badge('OPEN', 'b-yellow')}</div>
      ${!e.resolvedAt ? `<button class="btn good sm" onclick="uiChaosResolve('${e.id}')">Resolve</button>` : ''}
    </div>
      <div class="muted" style="font-size:12.5px;margin-top:4px">${esc(e.description)}</div>
      <div class="muted" style="font-size:12px;margin-top:2px">Target: ${esc(e.targetSquad?.name || e.targetUser?.fullName || 'studio-wide')} ·
        ${e.penaltyAmount ? 'Penalty ' + money(e.penaltyAmount) : 'no penalty'} ${e.penaltyAppliedAt ? '· <span style="color:var(--danger)">penalty applied</span>' : ''} · ${dt(e.createdAt)}</div>
      ${e.resolution ? `<div style="font-size:12.5px;margin-top:4px;color:var(--accent2)">✔ ${esc(e.resolution)}</div>` : ''}
    </div>`).join('') || '<div class="panel empty">No incidents — studio is calm</div>'}`;
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
    { name: 'timeLimitSeconds', label: 'Time limit (seconds)', type: 'number', value: 600 },
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
    <div class="page-head"><div><h2>Simulation Stock Exchange</h2>
      <div class="sub">Score = 50% normalized squad valuation + 50% normalized wallet</div></div></div>
    <div class="panel"><h3>Squad leaderboard</h3><table>
      <tr><th>#</th><th>Squad</th><th>Valuation</th><th>Health</th></tr>
      ${lb.squadLeaderboard.map((s) => `<tr><td>${s.rank}</td><td><b>${esc(s.squadName)}</b></td><td class="money">${money(s.valuation)}</td><td class="health-${s.healthStatus}">${statusBadge(s.healthStatus)}</td></tr>`).join('')}
    </table></div>
    <div class="panel"><h3>Student scores</h3><table>
      <tr><th>#</th><th>Student</th><th>Role</th><th>Wallet</th><th>Squad valuation</th><th>Score</th></tr>
      ${lb.studentScores.slice(0, 15).map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.fullName)}</td><td>${badge(s.role, 'b-gray')}</td><td class="money">${money(s.walletBalance)}</td><td>${money(s.squadValuation)}</td><td><b>${s.simulationScore}</b></td></tr>`).join('')}
    </table></div>`;
}

/* ------------------------------ Users / Settings ------------------------------ */
async function viewUsers() {
  const users = await api('GET', '/users');
  C().innerHTML = `<div class="page-head"><div><h2>Studio Roster</h2><div class="sub">33 students + faculty</div></div></div>
    <div class="panel"><table><tr><th>Name</th><th>Role</th><th>Tier</th><th>Email</th><th>Squads</th><th>User ID</th></tr>
      ${users.map((u) => `<tr><td>${esc(u.fullName)}</td><td>${statusBadge(u.role)}</td><td>${esc(u.tier || '—')}</td>
        <td class="muted">${esc(u.email)}</td><td>${(u.squadMemberships || []).map((m) => esc(m.squad?.name || '')).join(', ') || '—'}</td>
        <td class="mono muted">${u.id.slice(0, 8)}…</td></tr>`).join('')}
    </table></div>`;
}

async function viewSettings() {
  const settings = await api('GET', '/settings');
  C().innerHTML = `<div class="page-head"><div><h2>System Settings</h2><div class="sub">Economic constants — CEO only</div></div></div>
    <div class="panel"><table><tr><th>Key</th><th>Type</th><th>Value</th><th></th></tr>
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
    if (!S.tab) S.tab = 'overview';
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
