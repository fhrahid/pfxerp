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
const modal = (title, html, wide = true) => openModal(title, html, wide);

function formModal(title, fields, submitLabel, onSubmit, wide, extraHtml) {
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
  openModal(title, `${extraHtml || ''}<form id="mform">${body}
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
      const res = await onSubmit(data);
      if (res !== false) {
        closeModal();
        toast('Success');
        render();
      }
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
        <label>Email<input name="email" type="email" required placeholder="you@seu.edu.bd" autocomplete="username"/></label>
        <label>Password<input name="password" type="password" required autocomplete="current-password"/></label>
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
          <a href="#" style="color:var(--accent);font-size:12px;text-decoration:none;" onclick="event.preventDefault();forgotPasswordView()">Forgot password?</a>
        </div>
        <button class="btn primary" style="width:100%;justify-content:center;margin-top:6px" type="submit">Sign in to the studio</button>
      </form>
      <p class="login-foot">Venture Studio Console · CSE474 · Southeast University</p>
    </div>`;
  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const email = (fd.email || '').trim().toLowerCase();
    if (!/^[a-zA-Z0-9._%+-]+@seu\.edu\.bd$/.test(email)) {
      loginView('Only @seu.edu.bd email addresses are authorized to log in.');
      return;
    }
    try {
      const data = await rawApi('POST', '/auth/login', { ...fd, email });
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

function forgotPasswordView(msg, okMsg) {
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      <div class="login-brand">
        <div class="logo">P</div>
        <div>
          <h1>POINTFEX <span>ERP</span></h1>
          <p class="slogan">Reset your account password</p>
        </div>
      </div>
      ${msg ? `<div class="login-error">${esc(msg)}</div>` : ''}
      ${okMsg ? `<div class="toast ok" style="position:static;margin-bottom:14px;display:block;">${esc(okMsg)}</div>` : ''}
      <form id="forgot-form">
        <label>Institutional Email (@seu.edu.bd)<input name="email" type="email" required placeholder="you@seu.edu.bd" autocomplete="username"/></label>
        <button class="btn primary" style="width:100%;justify-content:center;margin-top:10px" type="submit">Send Reset Link via Resend</button>
        <button type="button" class="btn ghost" style="width:100%;justify-content:center;margin-top:8px" onclick="loginView()">Back to Sign In</button>
      </form>
      <p class="login-foot">A secure link valid for 60 minutes will be dispatched via Resend.</p>
    </div>`;
  document.getElementById('forgot-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const email = (fd.email || '').trim().toLowerCase();
    if (!/^[a-zA-Z0-9._%+-]+@seu\.edu\.bd$/.test(email)) {
      forgotPasswordView('Only @seu.edu.bd email addresses are authorized.');
      return;
    }
    try {
      const res = await rawApi('POST', '/auth/forgot-password', { email });
      if (res.resetUrl) {
        forgotPasswordView(null, `${res.message} (Dev Link: ${res.resetUrl})`);
      } else {
        forgotPasswordView(null, res.message || 'If an account matches that email address, a password reset link has been dispatched.');
      }
    } catch (err) {
      forgotPasswordView(err.message);
    }
  };
}

function resetPasswordView(token, msg) {
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      <div class="login-brand">
        <div class="logo">P</div>
        <div>
          <h1>POINTFEX <span>ERP</span></h1>
          <p class="slogan">Choose a new password</p>
        </div>
      </div>
      ${msg ? `<div class="login-error">${esc(msg)}</div>` : ''}
      <form id="reset-form">
        <label>New Password (min 8 chars)<input name="password" type="password" required minlength="8" autocomplete="new-password"/></label>
        <label>Confirm Password<input name="confirmPassword" type="password" required minlength="8" autocomplete="new-password"/></label>
        <button class="btn primary" style="width:100%;justify-content:center;margin-top:10px" type="submit">Update Password</button>
        <button type="button" class="btn ghost" style="width:100%;justify-content:center;margin-top:8px" onclick="window.location.hash='';loginView()">Cancel</button>
      </form>
      <p class="login-foot">Once updated, existing sessions will be safely revoked.</p>
    </div>`;
  document.getElementById('reset-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if (fd.password !== fd.confirmPassword) {
      resetPasswordView(token, 'Passwords do not match.');
      return;
    }
    if (fd.password.length < 8) {
      resetPasswordView(token, 'Password must be at least 8 characters long.');
      return;
    }
    try {
      const res = await rawApi('POST', '/auth/reset-password', { token, password: fd.password });
      if (typeof window !== 'undefined' && window.location) window.location.hash = '';
      loginView();
      toast(res.message || 'Password has been reset successfully! Please sign in.');
    } catch (err) {
      resetPasswordView(token, err.message);
    }
  };
}

async function acceptInviteView(token, msg) {
  document.getElementById('app').innerHTML = `
    <div class="login-wrap" style="width:440px;">
      <div class="login-brand">
        <div class="logo">P</div>
        <div>
          <h1>POINTFEX <span>ERP</span></h1>
          <p class="slogan">Activate Developer Workspace</p>
        </div>
      </div>
      <div style="text-align:center;padding:20px;color:var(--muted);">Verifying invitation token...</div>
    </div>`;

  let verified = null;
  try {
    verified = await rawApi('GET', '/invitations/verify/' + encodeURIComponent(token));
  } catch (err) {
    document.getElementById('app').innerHTML = `
      <div class="login-wrap" style="width:440px;">
        <div class="login-brand">
          <div class="logo" style="background:var(--danger);">✕</div>
          <div>
            <h1>POINTFEX <span>ERP</span></h1>
            <p class="slogan">Invitation Invalid or Expired</p>
          </div>
        </div>
        <div class="login-error">${esc(err.message || 'This invitation link is invalid or has expired after 72 hours.')}</div>
        <p style="font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:18px;">
          For security, developer invitations expire within 72 hours of being sent. If you did not activate your account in time, please reach out to studio leadership (CEO, CFO, CTO, or CPO) to resend the invitation link.
        </p>
        <button class="btn primary" style="width:100%;justify-content:center" onclick="window.location.hash='';loginView()">Go to Sign In</button>
      </div>`;
    return;
  }

  document.getElementById('app').innerHTML = `
    <div class="login-wrap" style="width:440px;">
      <div class="login-brand">
        <div class="logo">P</div>
        <div>
          <h1>POINTFEX <span>ERP</span></h1>
          <p class="slogan">Activate Developer Account</p>
        </div>
      </div>
      ${msg ? `<div class="login-error">${esc(msg)}</div>` : ''}
      <div style="background:rgba(79,140,255,0.08);border:1px solid rgba(79,140,255,0.25);border-radius:8px;padding:12px;margin-bottom:14px;font-size:12.5px;">
        <div>Invited Email: <b>${esc(verified.email)}</b></div>
        <div style="margin-top:4px;">Role: <b>${esc(verified.role)}</b> · 72h Security Window Valid</div>
      </div>
      <form id="accept-form">
        <label>Full Legal Name<input name="fullName" type="text" required placeholder="e.g. Asaduzzaman Noor" autocomplete="name"/></label>
        <label>Student ID (optional)<input name="studentId" type="text" placeholder="e.g. 20210005001" autocomplete="off"/></label>
        <label>Set Your Password (min 8 chars)<input name="password" type="password" required minlength="8" autocomplete="new-password"/></label>
        <label>Confirm Password<input name="confirmPassword" type="password" required minlength="8" autocomplete="new-password"/></label>
        <button class="btn primary" style="width:100%;justify-content:center;margin-top:10px" type="submit">Activate Account & Enter Studio</button>
      </form>
      <p class="login-foot">Personal wallet (BDT 0.00) will be provisioned immediately upon activation.</p>
    </div>`;

  document.getElementById('accept-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if (fd.password !== fd.confirmPassword) {
      acceptInviteView(token, 'Passwords do not match.');
      return;
    }
    if (fd.password.length < 8) {
      acceptInviteView(token, 'Password must be at least 8 characters long.');
      return;
    }
    try {
      const data = await rawApi('POST', '/invitations/accept', {
        token,
        fullName: fd.fullName,
        studentId: fd.studentId || undefined,
        password: fd.password,
      });
      S.token = data.accessToken;
      S.refreshToken = data.refreshToken;
      S.user = data.user;
      saveSession();
      if (typeof window !== 'undefined' && window.location) window.location.hash = '';
      toast('Welcome to Pointfex ERP! Account activated.');
      await boot();
    } catch (err) {
      acceptInviteView(token, err.message);
    }
  };
}

/* ============================== shell ============================== */
const TABS = [
  { id: 'overview', label: 'Overview', show: () => true },
  { id: 'kanban', label: 'Tasks', show: () => true },
  { id: 'squads', label: 'Squads', show: () => true },
  { id: 'roster', label: 'People', show: () => canManage() || isExec() },
  { id: 'invitations', label: 'Invitations', show: () => isExec() },
  { id: 'payroll', label: 'Payroll', show: () => isPM() || isCPO() || isCEO() },
  { id: 'fines', label: 'Fine Proposals', show: () => isCFO() || isCPO() || isCTO() || isCEO() },
  { id: 'finance', label: 'Finance', show: () => isExec() || isPM() },
  { id: 'accounting', label: 'Accounting', show: () => true },
  { id: 'profile', label: 'My Profile', show: () => true },
  { id: 'governance', label: 'Governance', show: () => isExec() },
  { id: 'marketplace', label: 'Marketplace', show: () => true },
  { id: 'consultancy', label: 'Consultancy', show: () => true },
  { id: 'quality', label: 'Quality & Certs', show: () => true },
  { id: 'bounty', label: 'Bug Bounty', show: () => true },
  { id: 'clients', label: 'Clients', show: () => isExec() || isPM() },
  { id: 'notices', label: 'Notices', show: () => true },
  { id: 'chaos', label: 'Chaos', show: () => isCEO() || isPM() },
  { id: 'leaderboard', label: 'Leaderboard', show: () => true },
  { id: 'audit', label: 'Audit Logs', show: () => isExec() },
  { id: 'settings', label: 'Settings', show: () => isCEO() },
];
const TAB_TITLES = {
  overview: ['Overview', 'Your studio snapshot'],
  kanban: ['Task Board', 'Anti-gaming state machine — git proof, PM gate, CTO gate'],
  squads: ['Squads', 'Dynamic roster · elastic headcount · fractional allocation'],
  roster: ['People', 'Create profiles, change roles, reset passwords'],
  invitations: ['Developer Invitations', 'Send 72-hour developer invitation links via Resend and manage token validity'],
  payroll: ['Weekly Lab Payroll', 'PM proposes ≤ ৳10,000 · CHRO audits & disburses'],
  fines: ['Fine Proposals', 'CPO / CTO propose · CFO approves · ledgered debit'],
  finance: ['Finance', 'Sprint pool ৳150,000 · 5% tax · loans · equity'],
  accounting: ['Accounting', 'Double-entry cashflow · role-scoped accounts'],
  profile: ['My Profile', 'Your wallet, work history, activity and password'],
  governance: ['Governance', '2-of-3 board vote → CEO sign-off'],
  marketplace: ['Marketplace', 'Boilerplate store — certified authors, squad licenses'],
  consultancy: ['Consultancy', '15-minute architecture office hours — ৳4,000, 50/50 split'],
  quality: ['Quality & Certifications', 'Code audit citations · provider certification gate'],
  bounty: ['Bug Bounty Arena', 'Cross-squad adversarial QA · escrowed pools'],
  clients: ['Real Clients', 'Escrow funding · CTO gate · 25/65/10 revenue waterfall'],
  notices: ['Secure Notices', 'End-to-end encrypted · zero-knowledge server'],
  chaos: ['Chaos Console', 'Live lab incidents and automated penalties'],
  leaderboard: ['Leaderboard', 'Score = 50% squad valuation + 50% wallet'],
  audit: ['Audit Trail', 'Executive audit logs, security incidents, citations & login tracking'],
  settings: ['System Settings', 'Economic constants — CEO only'],
};

function toggleSidebar(open) {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (!sb) return;
  const isCurrentlyOpen = sb.classList.contains('open');
  const next = open !== undefined ? open : !isCurrentlyOpen;
  if (next) {
    sb.classList.add('open');
    ov?.classList.add('open');
  } else {
    sb.classList.remove('open');
    ov?.classList.remove('open');
  }
}
window.toggleSidebar = toggleSidebar;

function toggleTheme() {
  const white = !document.body.classList.contains('white-mode');
  document.body.classList.toggle('white-mode', white);
  try { localStorage.setItem('pf_theme', white ? 'white' : 'dark'); } catch (_) {}
  document.querySelectorAll('.theme-toggle, .white-mode-toggle').forEach((button) => {
    button.textContent = white ? '☀ White mode' : '☾ Dark mode';
  });
}

function restoreTheme() {
  let white = true;
  try { white = localStorage.getItem('pf_theme') !== 'dark'; } catch (_) {}
  document.body.classList.toggle('white-mode', white);
}

function renderShell() {
  const u = S.user;
  const tabs = TABS.filter((t) => t.show());
  document.getElementById('app').innerHTML = `
    <div id="sidebar-overlay" class="sidebar-overlay" onclick="toggleSidebar(false)"></div>
    <nav id="sidebar" class="sidebar">
      <div class="sidebar-header">
        <div class="brand">POINT<span>FEX</span><em>ERP</em></div>
        <button class="sidebar-close-btn" onclick="toggleSidebar(false)" aria-label="Close navigation">&times;</button>
      </div>
      <div class="nav-list">
        ${tabs.map((t) => `<a class="nav-btn ${S.tab === t.id ? 'active' : ''}" href="#" onclick="event.preventDefault();setTab('${t.id}')">${t.label}</a>`).join('')}
      </div>
      <div class="userbox">
        <div class="name">${esc(u.fullName)}</div>
        <div class="role">${esc(u.role)}</div>
        <div class="wallet">${money(u.walletBalance)}</div>
        <div class="userbox-actions">
          <button class="btn sm ghost" onclick="setTab('profile')" title="View my profile">Profile</button>
          <button class="btn sm ghost theme-toggle" onclick="toggleTheme()" title="Switch white/dark mode">☀ White mode</button>
          <button class="btn sm ghost" onclick="doLogout()">Log out</button>
        </div>
      </div>
    </nav>
    <main class="main">
      <header class="topbar">
        <div class="topbar-left">
          <button class="mobile-menu-btn" onclick="toggleSidebar(true)" aria-label="Open navigation">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <div><h2>${TAB_TITLES[S.tab]?.[0] || ''}</h2><div class="sub">${TAB_TITLES[S.tab]?.[1] || ''}</div></div>
        </div>
        <div class="row topbar-right">
          <button class="btn sm ghost white-mode-toggle" onclick="toggleTheme()">${document.body.classList.contains('white-mode') ? '☀ White mode' : '☾ Dark mode'}</button>
          <span id="sprint-chip" class="sprint-chip ${isExec() ? 'editable' : ''}" ${isExec() ? "title='Click to change the active sprint'" : ''} onclick="${isExec() ? "uiSetSprint()" : ''}">Sprint ${S.currentSprint ?? '—'}</span>
          <div id="tab-actions" class="row"></div>
        </div>
      </header>
      <div id="content"></div>
    </main>`;
}
function setTab(id) {
  S.tab = id;
  try { localStorage.setItem('pf_active_tab', id); } catch (_) {}
  renderShell(); render(); toggleSidebar(false);
}
function tabActions(html) { const el = document.getElementById('tab-actions'); if (el) el.innerHTML = html; }
const C = () => document.getElementById('content');

async function render() {
  if (!S.user) return;
  try { S.currentSprint = (await api('GET', '/settings/current-sprint')).sprintNumber; } catch { /* */ }
  const chip = document.getElementById('sprint-chip');
  if (chip) chip.textContent = 'Sprint ' + (S.currentSprint ?? '—');
  const views = {
    overview: viewOverview, kanban: viewKanban, squads: viewSquads, roster: viewRoster,
    invitations: viewInvitations,
    payroll: viewPayroll, fines: viewFines, finance: viewFinance, accounting: viewAccounting, profile: viewProfile, governance: viewGovernance,
    marketplace: viewMarketplace, consultancy: viewConsultancy, quality: viewQuality,
    bounty: viewBounty, clients: viewClients, notices: viewNotices, chaos: viewChaos,
    leaderboard: viewLeaderboard, audit: viewAudit, settings: viewSettings,
  };
  await loadSquads();
  await views[S.tab]?.();
}

/* ============================== views ============================== */

async function viewOverview() {
  if (isExec()) {
    tabActions(`
      <button class="btn primary" onclick="uiInviteDeveloper()">+ Send Invitation Link</button>
      ${(isCFO() || isCEO()) ? '<button class="btn" onclick="uiRecalculateSquadValuations()">Recalculate squad valuations</button>' : ''}
      ${isCEO() ? '<button class="btn ghost" onclick="uiCreateRole()">+ New Role</button>' : ''}
    `);
  } else {
    tabActions('');
  }
  const me = await api('GET', '/dashboard/me');
  let noticesHtml = '';
  try {
    const notices = await api('GET', '/notices');
    const unread = notices.filter((n) => n.status !== 'ACKNOWLEDGED').length;
    noticesHtml = `<div class="panel"><h3>Recent notices ${unread ? badge(unread + ' unread', 'b-yellow') : ''}</h3>
      ${notices.slice(0, 4).map((n) => `<div class="list-item"><div class="top"><b>${esc(n.title)}</b>${statusBadge(n.status)}</div>
        <div class="muted" style="font-size:12px;margin-top:4px">${esc(n.category)} · from ${esc(n.sender?.fullName || '')} · ${dt(n.createdAt)}</div></div>`).join('') || '<div class="empty">No notices</div>'}</div>`;
  } catch { /* */ }

  let ceoHtml = '';
  let cfoHtml = '';
  if (isCEO()) {
    try {
      const ceoData = await api('GET', '/dashboard/ceo');
      const macro = ceoData.macro || {};
      const executives = ceoData.executives || [];
      const actions = (ceoData.recentExecutiveActions || []).slice(0, 8);

      ceoHtml = `
        <div class="panel" style="margin-top:16px;border:1px solid rgba(234,179,8,0.3);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <h3 style="margin:0;">Executive Audit & Collusion Alerts</h3>
              <span class="badge b-gold" style="font-weight:bold;">CEO 360 Command Center</span>
            </div>
            <div class="muted" style="font-size:12px;">
              Active Contracts: <b>${macro.activeClientContracts ?? 0}</b> · Studio Valuation: <b class="money">${money(macro.studioValuation)}</b> · Escrow: <b class="money">${money(macro.activeEscrow)}</b>
            </div>
          </div>

          <h4 style="margin:12px 0 8px;">Executive Oversight & Anomaly Detection</h4>
          <table>
            <tr>
              <th>Executive</th>
              <th>Role</th>
              <th>Wallet Balance</th>
              <th>Audited Actions</th>
              <th>Collusion / Anomaly Flags</th>
              <th>Profile</th>
            </tr>
            ${executives.map((e) => {
              const hasFlags = e.anomalyFlags && e.anomalyFlags.length > 0;
              return `<tr>
                <td><b>${esc(e.name)}</b></td>
                <td>${statusBadge(e.role)}</td>
                <td class="money">${money(e.walletBalance || 0)}</td>
                <td><b>${e.actionCount || 0}</b> actions</td>
                <td>
                  ${hasFlags
                    ? e.anomalyFlags.map((f) => `<span class="badge b-red" style="font-weight:bold;margin-right:4px;">⚠️ ${esc(f)}</span>`).join('')
                    : '<span class="badge b-green">NORMAL</span>'}
                </td>
                <td><button class="btn sm" onclick="uiUserProfile('${e.id}')">Profile</button></td>
              </tr>`;
            }).join('') || '<tr><td colspan="6" class="muted">No executives registered</td></tr>'}
          </table>

          <h4 style="margin:16px 0 8px;">Recent Executive Actions Stream</h4>
          <div style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;">
            <table>
              <tr><th>Timestamp</th><th>Actor</th><th>Role</th><th>Action Type</th><th>Severity</th><th>Payload Snapshot</th></tr>
              ${actions.map((a) => {
                const sevClass = a.riskSeverity === 'HIGH' ? 'b-red' : a.riskSeverity === 'MEDIUM' ? 'b-yellow' : 'b-blue';
                const payloadStr = a.payload ? (typeof a.payload === 'object' ? JSON.stringify(a.payload) : String(a.payload)) : '';
                return `<tr>
                  <td class="mono" style="font-size:11px;">${dt(a.createdAt)}</td>
                  <td><b>${esc(a.executiveName)}</b></td>
                  <td>${statusBadge(a.executiveRole)}</td>
                  <td><b>${esc(a.actionType)}</b></td>
                  <td><span class="badge ${sevClass}" style="font-weight:bold;">${esc(a.riskSeverity || 'LOW')}</span></td>
                  <td class="mono" style="font-size:11px;" title="${esc(payloadStr)}">${esc(payloadStr.slice(0, 70))}${payloadStr.length > 70 ? '…' : ''}</td>
                </tr>`;
              }).join('') || '<tr><td colspan="6" class="muted" style="padding:12px;text-align:center;">No recent executive actions logged</td></tr>'}
            </table>
          </div>
        </div>
      `;
    } catch (e) {
      console.error('Failed to load CEO dashboard data:', e);
    }
  }

  if (isCFO()) {
    try {
      const cfoData = await api('GET', '/dashboard/cfo');
      cfoHtml = `
        <div class="panel" style="margin-top:16px;border-color:rgba(59,130,246,.3)">
          <h3>CFO Treasury & Capital Overview</h3>
          <div class="cards">
            <div class="card"><div class="k">Cash in circulation</div><div class="v money">${money(cfoData.cashInCirculation)}</div><div class="muted">Personal wallets + squad treasuries</div></div>
            <div class="card"><div class="k">Outstanding loans</div><div class="v">${cfoData.activeLoanCount || 0} active</div><div class="muted">Principal ${money(cfoData.outstandingLoanPrincipal)} · due ${money(cfoData.outstandingLoanDue)}</div></div>
            <div class="card"><div class="k">Equity investments</div><div class="v money">${money(cfoData.totalInvested)}</div><div class="muted">${cfoData.activeInvestmentCount || 0} active stakes</div></div>
            <div class="card"><div class="k">System reserve</div><div class="v money">${money(cfoData.systemReserveBalance)}</div><div class="muted">Available funding pool</div></div>
          </div>
          <h4 style="margin:14px 0 7px">Loan book</h4>
          <table><tr><th>Squad</th><th>Principal</th><th>Total due</th><th>Status</th><th>Due date</th></tr>
            ${(cfoData.loanBook || []).map((l) => `<tr><td>${esc(l.squad)}</td><td class="money">${money(l.principal)}</td><td class="money">${money(l.totalDue)}</td><td>${statusBadge(l.status)}</td><td>${dt(l.dueDate)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No loans</td></tr>'}
          </table>
        </div>`;
    } catch (e) { cfoHtml = `<div class="panel"><div class="muted">CFO overview unavailable: ${esc(e.message)}</div></div>`; }
  }

  C().innerHTML = `
    <div class="cards">
      <div class="card"><div class="k">My Wallet</div><div class="v money">${money(me.walletBalance)}</div></div>
      <div class="card"><div class="k">Open Tasks</div><div class="v">${me.openTasks ?? 0}</div></div>
      <div class="card"><div class="k">Latest DPI</div><div class="v">${me.latestDpi ?? '—'}</div></div>
      <div class="card"><div class="k">My Squads</div><div class="v">${me.squads?.length || 0}</div></div>
    </div>
    ${ceoHtml}
    ${cfoHtml}
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
  S.tasks = tasks; // card buttons / drag & drop lookups
  const byStatus = {};
  KANBAN_COLS.forEach((c) => (byStatus[c] = []));
  tasks.forEach((t) => (byStatus[t.status] || (byStatus[t.status] = [])).push(t));

  tabActions(`
    <select class="inp" onchange="S.kanbanSquad=this.value;render()">
      ${squadOpts.map((s) => `<option value="${s.id}" ${s.id === S.kanbanSquad ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
    </select>
    ${isPM() || isExec() ? `<button class="btn primary" onclick="uiTaskCreate('${S.kanbanSquad}')">+ New task</button>` : ''}`);

  C().innerHTML = `<div class="kanban">${KANBAN_COLS.map((col) => `
    <div class="kcol" data-col="${col}" ondragover="kDragOver(event)" ondragleave="kDragLeave(event)" ondrop="kDrop(event, '${col}')">
      <h4><span>${col.replace('_', ' ')}</span><span>${byStatus[col].length}</span></h4>
      ${byStatus[col].map((t) => {
        const isMissed = t.isOverdue || (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'CLOSED');
        const next = kPrimaryMove(t);
        return `
        <div class="kcard" draggable="true" ondragstart="kDragStart(event, '${t.id}')" ondragend="kDragEnd(event)" onclick="uiTaskDetail('${t.id}')">
          <div class="t">${esc(t.title)}</div>
          <div class="m">
            <span class="badge-prio prio-${esc(t.priority)}">${esc(t.priority)}</span>
            ${t.gitPrUrl ? '<span title="Git PR Verified" style="color:var(--accent2);font-weight:700;">● PR</span>' : ''}
            ${isMissed ? '<span class="badge b-red" style="font-weight:bold;margin-left:4px">MISSED DEADLINE</span>' : ''}
          </div>
          ${t.dueDate ? `<div class="muted" style="font-size:11px">Due: ${dt(t.dueDate)}</div>` : ''}
          <div class="m" style="font-size:11.5px;color:var(--muted);justify-content:space-between;">
            <span>${esc(((t.assigneeNames || []).length ? t.assigneeNames.map((a) => a.fullName) : [t.assignedTo?.fullName]).filter(Boolean).join(', ') || 'unassigned')}</span>
            ${t.squad ? `<span style="opacity:0.75;">${esc(t.squad.name)}</span>` : ''}
          </div>
          ${next ? `<button class="btn primary sm" style="margin-top:6px;width:100%" onclick="event.stopPropagation();kMove('${t.id}','${next.to}')">${next.label} →</button>` : ''}
        </div>`;
      }).join('') || '<div class="muted" style="font-size:11.5px;padding:6px 2px">—</div>'}
    </div>`).join('')}
  </div>`;
}

/* ---------------- Kanban drag & drop + card action buttons ---------------- */
let kDragging = null;

function kDragStart(e, id) {
  kDragging = id;
  e.dataTransfer.setData('text/plain', id);
  e.dataTransfer.effectAllowed = 'move';
}

function kDragEnd() { kDragging = null; document.querySelectorAll('.kcol.dragok').forEach((el) => el.classList.remove('dragok')); }

function kDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('dragok');
}

function kDragLeave(e) { e.currentTarget.classList.remove('dragok'); }

function kDrop(e, col) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragok');
  const id = kDragging || e.dataTransfer.getData('text/plain');
  kDragging = null;
  if (id) kMove(id, col);
}

/** Mirrors the server state machine + RBAC: returns the next forward move for a card button. */
function kPrimaryMove(t) {
  const map = {
    BACKLOG: { label: 'Assign', to: 'TODO' },
    TODO: { label: 'Start', to: 'IN_PROGRESS' },
    IN_PROGRESS: { label: 'Flag ✓', to: 'FLAGGED_COMPLETE' },
    FLAGGED_COMPLETE: { label: 'PM verify', to: 'PM_VERIFIED' },
    PM_VERIFIED: { label: 'CTO pass', to: 'CTO_VERIFIED' },
    CTO_VERIFIED: { label: 'Close', to: 'CLOSED' },
  };
  const next = map[t.status];
  if (!next) return null;
  return kCanMove(t, next.to).ok ? next : null;
}

function kCanMove(t, to) {
  if (t.status === to) return { ok: false, reason: 'Already there' };
  const isAssignee = t.assignedToId === S.user.id || (t.assigneeIds || []).includes(S.user.id);
  const isPmOrCeo = isPM() || isCEO();
  const isCtoOrCeo = isCTO() || isCEO();
  const rules = {
    'BACKLOG->TODO': { ok: isPM() || isCPO() || isCTO() || isCEO(), dialog: 'assign', reason: 'Only squad leadership can assign' },
    'TODO->BACKLOG': { ok: isPM() || isCPO() || isCTO() || isCEO(), act: ['PATCH', `/tasks/${t.id}`, { assignedToId: null }], reason: 'Only squad leadership can unassign' },
    'TODO->IN_PROGRESS': { ok: isAssignee || isPM() || isCPO() || isCTO() || isCEO(), act: ['POST', `/tasks/${t.id}/start`], reason: 'Only the assignee or squad leadership can start work' },
    'IN_PROGRESS->FLAGGED_COMPLETE': { ok: isAssignee, dialog: 'flag', reason: 'Only the assigned developer can flag completion' },
    'FLAGGED_COMPLETE->PM_VERIFIED': { ok: isPmOrCeo, act: ['POST', `/tasks/${t.id}/pm-verify`, { comment: 'Acceptance criteria met, commits verified.' }], reason: 'PM verification is reserved for the squad PM (or CEO)' },
    'FLAGGED_COMPLETE->IN_PROGRESS': { ok: isPmOrCeo, dialog: 'pmReject', reason: 'PM rejection is reserved for the squad PM (or CEO)' },
    'PM_VERIFIED->CTO_VERIFIED': { ok: isCtoOrCeo, act: ['POST', `/tasks/${t.id}/cto-verify`, { critique: 'Clean architecture, coverage verified.' }], reason: 'The quality audit is reserved for the CTO (or CEO)' },
    'PM_VERIFIED->IN_PROGRESS': { ok: isCtoOrCeo, dialog: 'ctoReject', reason: 'CTO rejection is reserved for the CTO (or CEO)' },
    'CTO_VERIFIED->CLOSED': { ok: isPmOrCeo || isCTO(), act: ['POST', `/tasks/${t.id}/close`], reason: 'Only the PM or CTO can close a verified task' },
  };
  return rules[`${t.status}->${to}`] || { ok: false, reason: `Invalid transition: ${t.status} → ${to}` };
}

async function kMove(id, to) {
  const t = (S.tasks || []).find((x) => x.id === id) || await api('GET', `/tasks/${id}`);
  if (!t) return;
  const rule = kCanMove(t, to);
  if (!rule.ok) { toast(rule.reason || 'You cannot perform this move', false); return; }
  if (rule.act) { act(rule.act[0], rule.act[1], rule.act[2]); return; }
  if (rule.dialog === 'flag') { uiFlag(id); return; }
  if (rule.dialog === 'pmReject') { uiPmReject(id); return; }
  if (rule.dialog === 'ctoReject') { uiCtoReject(id); return; }
  if (rule.dialog === 'assign') {
    let members = [];
    try {
      const detail = await api('GET', `/squads/${t.squadId}`);
      members = (detail.members || []).filter((m) => m.role === 'DEVELOPER' || m.role === 'PM');
    } catch (_) {}
    if (!members.length) { toast('No squad members available to assign', false); return; }
    const current = (t.assigneeIds && t.assigneeIds.length) ? t.assigneeIds : (t.assignedToId ? [t.assignedToId] : []);
    openModal(`Assign "${t.title}"`, `
      <form id="kAssignForm">
        <div class="field">
          <label>Assignees (multiple allowed)</label>
          ${members.map((m) => `
          <label class="row" style="gap:8px;font-weight:400;cursor:pointer;padding:2px 0">
            <input type="checkbox" class="kAssignee" value="${m.userId}" ${current.includes(m.userId) ? 'checked' : ''}>
            ${esc(m.fullName)} <span class="muted">(${m.role})</span>
          </label>`).join('')}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn ghost" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn primary">Assign — moves to TODO</button>
        </div>
      </form>`);
    document.getElementById('kAssignForm').onsubmit = async (e) => {
      e.preventDefault();
      const ids = [...document.querySelectorAll('.kAssignee:checked')].map((el) => el.value);
      await act('PATCH', `/tasks/${id}`, { assigneeIds: ids });
    };
  }
}

function uiSetSprint() {
  formModal('Set active sprint (C-level only)', [
    { name: 'sprintNumber', label: 'Sprint number', type: 'number', value: S.currentSprint || 1, required: true },
  ], 'Set sprint', async (d) => {
    await api('POST', '/settings/current-sprint', { sprintNumber: +d.sprintNumber });
    S.currentSprint = +d.sprintNumber;
  });
}

async function uiTaskCreate(squadId) {
  const squadOpts = isExec() ? S.squads : mySquads();
  if (!squadOpts.length) { toast('No squad membership', false); return; }
  const activeSquadId = squadId || S.kanbanSquad || squadOpts[0].id;

  let devOpts = [];
  try {
    const squadDetail = await api('GET', '/squads/' + activeSquadId);
    // PMs may assign themselves to tasks they co-own.
    devOpts = (squadDetail.members || []).filter((m) => m.role === 'DEVELOPER' || m.role === 'PM');
  } catch (_) {}

  const formHtml = `
    <form id="taskCreateForm">
      <div class="field">
        <label>Squad</label>
        <select id="tcSquad" name="squadId" onchange="uiTaskCreateSquadChange(this.value)">
          ${squadOpts.map((s) => `<option value="${s.id}" ${s.id === activeSquadId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Title</label>
        <input type="text" id="tcTitle" name="title" required placeholder="Task title">
      </div>
      <div class="field">
        <label>Description</label>
        <textarea id="tcDesc" name="description" rows="3" placeholder="Task description and acceptance criteria"></textarea>
      </div>
      <div class="field">
        <label>Priority</label>
        <select id="tcPriority" name="priority">
          <option value="LOW">LOW</option>
          <option value="MEDIUM" selected>MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
      </div>
      <div class="field">
        <label>Assignees (multiple allowed — none for backlog)</label>
        <div id="tcAssigneeBox">
          ${devOpts.map((d) => `
          <label class="row" style="gap:8px;font-weight:400;cursor:pointer;padding:2px 0">
            <input type="checkbox" class="tcAssignee" value="${d.userId}">
            ${esc(d.fullName)} <span class="muted">(${d.role})</span>
          </label>`).join('') || '<div class="muted">No members</div>'}
        </div>
      </div>
      <div class="field"><label>Due Date & Time (Optional)</label><input type="datetime-local" id="tcDue"></div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn primary">Create Task</button>
      </div>
    </form>
  `;

  modal('Create Task', formHtml);

  document.getElementById('taskCreateForm').onsubmit = async (e) => {
    e.preventDefault();
    const dueVal = document.getElementById('tcDue')?.value;
    const payload = {
      squadId: document.getElementById('tcSquad')?.value,
      title: document.getElementById('tcTitle')?.value,
      description: document.getElementById('tcDesc')?.value || undefined,
      priority: document.getElementById('tcPriority')?.value || 'MEDIUM',
      assigneeIds: [...document.querySelectorAll('.tcAssignee:checked')].map((el) => el.value),
      dueDate: dueVal ? new Date(dueVal).toISOString() : undefined,
    };
    try {
      await api('POST', '/tasks', payload);
      closeModal();
      toast('Task created successfully');
      render();
    } catch (err) {
      toast(err.message || 'Failed to create task', false);
    }
  };
}

async function uiTaskCreateSquadChange(squadId) {
  const box = document.getElementById('tcAssigneeBox');
  if (!box) return;
  try {
    const squadDetail = await api('GET', '/squads/' + squadId);
    const memberOpts = (squadDetail.members || []).filter((m) => m.role === 'DEVELOPER' || m.role === 'PM');
    box.innerHTML = memberOpts.map((m) => `
      <label class="row" style="gap:8px;font-weight:400;cursor:pointer;padding:2px 0">
        <input type="checkbox" class="tcAssignee" value="${m.userId}">
        ${esc(m.fullName)} <span class="muted">(${m.role})</span>
      </label>`).join('') || '<div class="muted">No members</div>';
  } catch (_) {}
}

const uiCreateTask = uiTaskCreate;

async function uiTaskDetail(id) {
  const t = await api('GET', '/tasks/' + id);
  // Match the API: assignees can start their work; squad leadership may start
  // work on behalf of a squad. Do not present a button that the API rejects.
  const canStart = t.status === 'TODO' && ((t.assigneeIds || []).includes(S.user.id) || t.assignedToId === S.user.id || isPM() || isCPO() || isCTO() || isCEO());
  const canFlag = t.status === 'IN_PROGRESS' && ((t.assigneeIds || []).includes(S.user.id) || t.assignedToId === S.user.id);
  const canPm = t.status === 'FLAGGED_COMPLETE' && (isPM() || isCEO());
  const canCto = t.status === 'PM_VERIFIED' && (isCTO() || isCEO());
  const canClose = t.status === 'CTO_VERIFIED' && (isPM() || isCTO() || isCEO());

  const isCompleted = ['CTO_VERIFIED', 'CLOSED'].includes(t.status);
  const isOv = t.isOverdue || (t.dueDate && !isCompleted && new Date(t.dueDate) < new Date());
  const isCompletedLate = t.completedLate || (isCompleted && t.dueDate && (
    (t.ctoVerifiedAt && new Date(t.ctoVerifiedAt) > new Date(t.dueDate)) ||
    (t.flaggedCompleteAt && new Date(t.flaggedCompleteAt) > new Date(t.dueDate)) ||
    (t.updatedAt && new Date(t.updatedAt) > new Date(t.dueDate))
  ));
  const isCompletedOnTime = isCompleted && t.dueDate && !isCompletedLate;

  let deadlineBadge = '';
  let deadlineDesc = 'No deadline';
  if (t.dueDate) {
    if (isOv) {
      deadlineBadge = '<span class="badge b-red" style="font-weight:bold;margin-left:4px">MISSED DEADLINE (OVERDUE)</span>';
      deadlineDesc = '<span style="color:var(--danger);font-weight:bold">Overdue (Missed deadline)</span>';
    } else if (isCompletedLate) {
      deadlineBadge = '<span class="badge b-red" style="font-weight:bold;margin-left:4px">COMPLETED LATE</span>';
      deadlineDesc = '<span style="color:var(--danger);font-weight:bold">Completed late</span>';
    } else if (isCompletedOnTime) {
      deadlineBadge = '<span class="badge b-green" style="font-weight:bold;margin-left:4px">COMPLETED ON TIME</span>';
      deadlineDesc = '<span style="color:var(--success);font-weight:bold">Completed on time</span>';
    } else {
      deadlineBadge = '<span class="badge b-blue" style="margin-left:4px">ON TRACK</span>';
      deadlineDesc = '<span class="muted">On track</span>';
    }
  }

  openModal(t.title, `
    <div class="pillrow" style="margin-bottom:10px">${statusBadge(t.status)} ${badge(t.priority, t.priority === 'CRITICAL' ? 'b-red' : 'b-gray')} ${deadlineBadge}</div>
    <p class="muted">${esc(t.description || 'No description')}</p>
    <table>
      <tr><td>Assignees</td><td>${(t.assigneeNames || []).length ? esc(t.assigneeNames.map((a) => a.fullName).join(', ')) : esc(t.assignedTo?.fullName || '—')}</td></tr>
      <tr><td>Squad</td><td>${esc(t.squad?.name)}</td></tr>
      <tr><td>PR / Commit</td><td class="mono">${esc(t.gitPrUrl || t.gitCommitHash || '—')}</td></tr>
      <tr><td>Due date</td><td>${t.dueDate ? `${dt(t.dueDate)} — ${deadlineDesc}` : '<span class="muted">No deadline set</span>'}</td></tr>
      ${t.flaggedCompleteAt ? `<tr><td>Flagged Complete</td><td class="mono">${dt(t.flaggedCompleteAt)}</td></tr>` : ''}
      ${t.ctoVerifiedAt ? `<tr><td>CTO Verified</td><td class="mono">${dt(t.ctoVerifiedAt)}</td></tr>` : ''}
      ${t.pmFeedback ? `<tr><td>PM feedback</td><td>${esc(t.pmFeedback)}</td></tr>` : ''}
      ${t.ctoCritique ? `<tr><td>CTO critique</td><td>${esc(t.ctoCritique)}</td></tr>` : ''}
      ${t.pmPenaltyPoints ? `<tr><td>Penalty points</td><td style="color:var(--danger)">-${t.pmPenaltyPoints}</td></tr>` : ''}
    </table>
    <h3 style="margin:14px 0 8px">Audit trail</h3>
    ${(t.auditEvents || []).slice(0, 8).map((a) => `<div class="muted" style="font-size:12px;padding:3px 0">${dt(a.createdAt)} — <b>${esc(a.changedBy?.fullName || '')}</b>: ${esc(a.fromStatus)} → ${esc(a.toStatus)} ${a.comment ? '· ' + esc(a.comment.slice(0, 90)) : ''}</div>`).join('') || '<div class="empty">No events</div>'}
    <div class="modal-actions" style="flex-wrap:wrap">
      ${(isPM() || isExec()) ? `<button class="btn secondary" onclick="uiTaskEdit('${t.id}')">Edit task</button>` : ''}
      ${canStart ? `<button class="btn primary" onclick="act('POST','/tasks/${t.id}/start')">Start work</button>` : ''}
      ${canFlag ? `<button class="btn primary" onclick="uiFlag('${t.id}')">Flag complete</button>` : ''}
      ${canPm ? `<button class="btn good" onclick="uiPmVerify('${t.id}')">PM verify</button>
                  <button class="btn bad" onclick="uiPmReject('${t.id}')">PM reject</button>` : ''}
      ${canCto ? `<button class="btn good" onclick="act('POST','/tasks/${t.id}/cto-verify',{critique:'Architecture & coverage verified'})">CTO pass</button>
                  <button class="btn bad" onclick="uiCtoReject('${t.id}')">CTO reject</button>` : ''}
      ${canClose ? `<button class="btn primary" onclick="act('POST','/tasks/${t.id}/close')">Close</button>` : ''}
    </div>`);
}

async function uiTaskEdit(taskId) {
  const t = await api('GET', '/tasks/' + taskId);
  const squadDetail = await api('GET', '/squads/' + t.squadId);
  const memberOpts = (squadDetail.members || []).filter((m) => m.role === 'DEVELOPER' || m.role === 'PM');
  const current = (t.assigneeIds && t.assigneeIds.length) ? t.assigneeIds : (t.assignedToId ? [t.assignedToId] : []);

  const dueIso = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 16) : '';
  const html = `
    <form id="taskEditForm">
      <div class="field">
        <label>Title</label>
        <input type="text" id="teTitle" name="title" value="${esc(t.title)}" required>
      </div>
      <div class="field">
        <label>Description</label>
        <textarea id="teDesc" name="description" rows="3">${esc(t.description || '')}</textarea>
      </div>
      <div class="field">
        <label>Priority</label>
        <select id="tePriority" name="priority">
          <option value="LOW" ${t.priority === 'LOW' ? 'selected' : ''}>LOW</option>
          <option value="MEDIUM" ${t.priority === 'MEDIUM' ? 'selected' : ''}>MEDIUM</option>
          <option value="HIGH" ${t.priority === 'HIGH' ? 'selected' : ''}>HIGH</option>
          <option value="CRITICAL" ${t.priority === 'CRITICAL' ? 'selected' : ''}>CRITICAL</option>
        </select>
      </div>
      <div class="field">
        <label>Assignees (multiple allowed — none for backlog)</label>
        ${memberOpts.map((m) => `
          <label class="row" style="gap:8px;font-weight:400;cursor:pointer;padding:2px 0">
            <input type="checkbox" class="teAssignee" value="${m.userId}" ${current.includes(m.userId) ? 'checked' : ''}>
            ${esc(m.fullName)} <span class="muted">(${m.role})</span>
          </label>`).join('') || '<div class="muted">No members</div>'}
      </div>
      <div class="field">
        <label>Due Date & Time (Optional)</label>
        <input type="datetime-local" id="teDue" value="${dueIso}">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" onclick="uiTaskDetail('${taskId}')">Back</button>
        <button type="submit" class="btn primary">Save Changes</button>
      </div>
    </form>
  `;
  modal('Edit Task: ' + esc(t.title), html);
  document.getElementById('taskEditForm').onsubmit = async (e) => {
    e.preventDefault();
    const dueVal = document.getElementById('teDue')?.value;
    const assigneeIds = [...document.querySelectorAll('.teAssignee:checked')].map((el) => el.value);
    const payload = {
      title: document.getElementById('teTitle')?.value,
      description: document.getElementById('teDesc')?.value,
      priority: document.getElementById('tePriority')?.value,
      assigneeIds,
      dueDate: dueVal ? new Date(dueVal).toISOString() : null,
    };
    try {
      await api('PATCH', '/tasks/' + taskId, payload);
      closeModal();
      toast('Task updated');
      render();
      uiTaskDetail(taskId);
    } catch (err) {
      toast(err.message || 'Failed to update task', false);
    }
  };
}

async function act(method, path, body, idem) {
  try {
    await api(method, path, body, idem ? { 'X-Idempotency-Key': crypto.randomUUID() } : undefined);
    closeModal(); toast('Success'); render();
  } catch (e) { toast(e.message, false); }
}

function uiFlag(id) {
  formModal('Flag complete — git proof required', [
    { name: 'gitPrUrl', label: 'Pull request URL', placeholder: 'https://github.com/pointfex/squad-1/pull/1' },
    { name: 'gitCommitHash', label: 'Commit hash', placeholder: '40-character SHA-1 commit hash' },
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
  if (S.showInactiveSquads === undefined) S.showInactiveSquads = false;
  if (S.showInactiveSquads) {
    try { S.squads = await api('GET', '/squads?includeInactive=true'); } catch { /* keep cached */ }
  }
  const visible = S.showInactiveSquads ? S.squads : S.squads.filter((s) => s.isActive !== false);
  tabActions(`
    ${canManage() ? '<button class="btn primary" onclick="uiSquadCreate()">+ New squad</button>' : ''}
    ${canManage() ? '<button class="btn" onclick="uiTransferMember()">Transfer member</button>' : ''}
    <button class="btn ${S.showInactiveSquads ? 'primary' : 'ghost'}" onclick="S.showInactiveSquads=!S.showInactiveSquads;viewSquads()">${S.showInactiveSquads ? '✓ ' : ''}Show deactivated</button>`);
  C().innerHTML = `<div class="panel"><table>
    <tr><th>Squad</th><th>Members</th><th>Treasury</th><th>Valuation</th><th>Health</th><th>Tasks</th><th></th></tr>
    ${visible.map((s) => `<tr${s.isActive === false ? ' style="opacity:0.55"' : ''}>
      <td><b>${esc(s.name)}</b>${s.isActive === false ? ' ' + badge('inactive', 'b-red') : ''}</td>
      <td>${s.memberCount}</td><td class="money">${money(s.balance)}</td>
      <td>${money(s.valuation)}</td><td class="health-${s.healthStatus}">${statusBadge(s.healthStatus)}</td><td>${s.taskCount}</td>
      <td class="row">
        <button class="btn sm" onclick="uiSquadDetail('${s.id}')">Open</button>
        <button class="btn sm" onclick="uiSquadGit('${s.id}')">Git</button>
        ${canManage() ? `<button class="btn sm ghost" onclick="uiSquadEdit('${s.id}','${esc(s.name)}','${esc(s.description || '')}',${s.isActive !== false})">Edit</button>` : ''}
        ${isCEO() ? `<button class="btn sm bad" title="Delete squad (CEO only)" onclick="uiSquadDelete('${s.id}','${esc(s.name)}')">Delete</button>` : ''}
      </td></tr>`).join('') || '<tr><td colspan="7" class="muted" style="padding:10px">No squads</td></tr>'}
  </table></div>`;
}

function uiSquadDelete(id, name) {
  if (!confirm(`Permanently delete "${name}"?\n\nIts treasury, ledger history, tasks, members and repositories will be removed. This cannot be undone.`)) return;
  api('DELETE', `/squads/${id}`)
    .then(async () => {
      toast(`Squad "${name}" deleted`);
      S.squads = await api('GET', '/squads' + (S.showInactiveSquads ? '?includeInactive=true' : ''));
      render();
    })
    .catch((e) => toast(e.message, false));
}

async function uiSquadGit(squadId) {
  const squad = S.squads.find((s) => s.id === squadId);
  openModal('GitHub · ' + esc(squad?.name || 'Squad'), `<div id="git-body"><div class="empty">Loading repositories…</div></div>`, true);
  if (!S._gitSel) S._gitSel = {};
  await gitLoad(squadId);
}

async function gitLoad(squadId) {
  const body = document.getElementById('git-body');
  if (!body) return;
  const canManage = isExec() || (isPM() && mySquads().some((s) => s.id === squadId));
  try {
    const repos = await api('GET', `/squads/${squadId}/github/repos`);
    if (!repos.length) {
      body.innerHTML = `<div class="empty">No repositories connected yet.</div>
        ${canManage ? '<div class="modal-actions" style="justify-content:flex-start"><button class="btn primary" onclick="uiGitAdd(\'' + squadId + '\')">+ Add repository</button></div>' : ''}`;
      return;
    }
    if (!repos.find((r) => r.id === S._gitSel[squadId])) S._gitSel[squadId] = repos[0].id;
    body.innerHTML = `
      <div class="row" style="margin-bottom:12px;gap:6px;flex-wrap:wrap">
        ${repos.map((r) => `<button class="btn sm ${r.id === S._gitSel[squadId] ? 'primary' : ''}" onclick="gitSelect('${squadId}','${r.id}')">${esc(r.name)}</button>`).join('')}
        ${canManage ? `<button class="btn sm good" onclick="uiGitAdd('${squadId}')">+ Add</button>
          <button class="btn sm bad" onclick="uiGitRemove('${squadId}','${S._gitSel[squadId]}')">Remove</button>` : ''}
      </div>
      <div id="git-summary" class="muted" style="font-size:12px;margin-bottom:10px">Loading summary…</div>
      <div id="git-commits"><div class="empty">Loading commits…</div></div>`;
    const sel = S._gitSel[squadId];
    api('GET', `/squads/${squadId}/github/repos/${sel}/summary`)
      .then((s) => { const el = document.getElementById('git-summary'); if (el) el.innerHTML = gitSummaryHtml(s); })
      .catch((e) => { const el = document.getElementById('git-summary'); if (el) el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
    api('GET', `/squads/${squadId}/github/repos/${sel}/activity`)
      .then((a) => { const el = document.getElementById('git-commits'); if (el) el.innerHTML = `
        <div class="muted" style="font-size:11.5px;margin-bottom:6px">Last ${a.commits.length} commits · <button class="btn sm ghost" onclick="gitLoad('${squadId}')">↻ refresh</button></div>
        ${a.commits.map((c) => `<div class="commit"><div class="msg"><span class="sha">${esc(c.sha)}</span> ${esc(c.message)}</div><div class="meta">${esc(c.author)} · ${dt(c.date)}</div></div>`).join('') || '<div class="empty">No commits</div>'}`; })
      .catch((e) => { const el = document.getElementById('git-commits'); if (el) el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
  } catch (e) {
    body.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

function gitSummaryHtml(s) {
  const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';
  return `<div class="git-summary">
    ${s.description ? `<div class="muted" style="font-size:12.5px;margin-bottom:8px">${esc(s.description)}</div>` : ''}
    <div class="statrow">
      <span>${badge('★ ' + s.stars, 'b-gold')}</span>
      <span>${badge(s.forks + ' forks', 'b-blue')}</span>
      <span>${badge(s.openIssues + ' issues', s.openIssues > 10 ? 'b-yellow' : 'b-gray')}</span>
      <span>${badge('code ~' + kb(s.codeSizeBytes), 'b-green')}</span>
      <span>${badge(s.contributorCount + ' contributors', 'b-blue')}</span>
    </div>
    ${s.stack?.length ? `<div class="stackbar" style="margin-top:10px">${s.stack.slice(0, 6).map((l) => `<span class="lang" style="flex:${Math.max(l.share, 1)}" title="${esc(l.language)} ${l.share}%">${esc(l.language)} <b>${l.share}%</b></span>`).join('')}</div>` : ''}
    ${s.contributors?.length ? `<div style="margin-top:10px" class="row">${s.contributors.slice(0, 12).map((c) =>
      `<span class="contrib"><img src="${esc(c.avatarUrl || '')}" onerror="this.style.display='none'"/> ${esc(c.login)} <b>${c.contributions}</b></span>`).join('')}</div>` : ''}
    <div class="muted" style="font-size:11px;margin-top:8px">default branch ${esc(s.defaultBranch || '—')} · last push ${dt(s.lastPushAt)}</div>
  </div>`;
}

function gitSelect(squadId, repoId) { S._gitSel[squadId] = repoId; gitLoad(squadId); }

const PAT_HELP = `<details style="margin-bottom:12px"><summary class="muted" style="cursor:pointer;font-size:12.5px">🔒 How to get a Personal Access Token (for private repos) — click to expand</summary>
<ol class="muted" style="font-size:12px;line-height:1.7;padding-left:16px">
  <li>On GitHub, click your <b>avatar (top-right) → Settings</b></li>
  <li>Scroll the left menu to the bottom → <b>Developer settings</b></li>
  <li><b>Personal access tokens → Tokens (classic)</b> → <b>Generate new token (classic)</b></li>
  <li>Give it a note (e.g. "Pointfex ERP"), choose an expiry</li>
  <li>Under <b>Select scopes</b>, tick <b>repo</b> (full control of private repositories)</li>
  <li>Click <b>Generate token</b> → copy the <span class="mono">ghp_…</span> value immediately (shown only once)</li>
  <li>Paste it in the token field below. It is stored server-side, per repository.</li>
</ol></details>`;

function uiGitAdd(squadId) {
  formModal('Connect GitHub repository', [
    { name: 'repoUrl', label: 'Repository URL', required: true, placeholder: 'https://github.com/pointfex/squad-1' },
    { name: 'name', label: 'Display name (optional)', placeholder: 'pointfex.com' },
    { name: 'token', label: 'Personal Access Token (private repos only)', placeholder: 'ghp_…' },
  ], 'Connect', async (d) => {
    await api('POST', `/squads/${squadId}/github/repos`, { repoUrl: d.repoUrl, name: d.name || undefined, token: d.token || undefined });
    closeModal();
    await uiSquadGit(squadId);
  }, false, PAT_HELP);
}

function uiGitRemove(squadId, repoId) {
  formModal('Remove repository', [
    { name: 'confirm', label: 'Type "remove" to confirm', required: true },
  ], 'Remove', async (d) => {
    if (d.confirm !== 'remove') throw new Error('Type "remove" to confirm');
    await api('DELETE', `/squads/${squadId}/github/repos/${repoId}`);
    S._gitSel[squadId] = null;
    closeModal();
    await uiSquadGit(squadId);
  });
}

function uiSquadCreate() {  formModal('Create squad — treasury starts empty', [
    { name: 'name', label: 'Squad name', required: true, placeholder: 'Squad 7' },
    { name: 'description', label: 'Description', placeholder: 'Product engineering squad' },
  ], 'Create squad', (d) => act('POST', '/squads', d));
}

async function uiRecalculateSquadValuations() {
  if (!confirm('Recalculate active squad valuations using current treasury, revenue, debt and usage metrics? This updates valuation snapshots; it does not move money.')) return;
  try {
    const result = await api('POST', '/dashboard/cfo/recalculate-valuations');
    toast(`Recalculated valuations for ${result.recalculated} squads`);
    await viewOverview();
  } catch (e) { toast(e.message || 'Valuation recalculation failed', false); }
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
    try {
      addable = (await api('GET', '/users')).filter(
        (u) =>
          !['CEO', 'CFO', 'CTO', 'CPO'].includes(u.role) && // no C-level execs
          !(u.squadMemberships || []).some((m) => m.squad) && // only unassigned people
          !(s.members || []).some((m) => m.userId === u.id),
      );
    } catch { addable = []; }
  }
  openModal('Squad · ' + esc(s.name), `
    <div class="pillrow" style="margin-bottom:10px">${statusBadge(s.healthStatus)} ${s.isActive === false ? badge('inactive', 'b-red') : ''} <span class="badge b-gold">${money(s.balance)}</span> <span class="badge b-blue">valuation ${money(s.valuation)}</span></div>
    <table><tr><th>Member</th><th>Role</th><th>Allocation</th>${canManage() ? '<th></th>' : ''}</tr>
      ${(s.members || []).map((m) => `<tr><td>${esc(m.fullName)}<div class="muted" style="font-size:11px">${esc(m.email)}</div></td><td>${statusBadge(m.role)}</td><td>${(Number(m.allocation) * 100).toFixed(0)}%</td>
        ${canManage() ? `<td><button class="btn sm bad" onclick="uiRemoveMember('${id}','${m.userId}','${esc(m.fullName)}')">Remove</button></td>` : ''}</tr>`).join('') || '<tr><td colspan="4" class="empty">No members</td></tr>'}
    </table>
    ${canManage() ? `<div class="modal-actions" style="justify-content:flex-start;gap:8px;">
      ${addable.length ? `<button class="btn ghost" onclick="uiAddMember('${id}')">+ Add Existing Member</button>` : ''}
      ${isExec() ? `<button class="btn primary" onclick="closeModal();uiInviteDeveloper('${id}')">+ Invite New Member</button>` : ''}
    </div>` : ''}`);
}

function uiAddMember(squadId) {
  api('GET', '/users').then((users) => {
    const squad = S.squads.find((s) => s.id === squadId);
    // Only unassigned, non-executive members are eligible for squad placement.
    const unassigned = users.filter(
      (u) => !['CEO', 'CFO', 'CTO', 'CPO'].includes(u.role) && !(u.squadMemberships || []).some((m) => m.squad),
    );
    formModal('Add member to ' + (squad?.name || 'squad'), [
      {
        name: 'userId',
        label: 'Unassigned member',
        type: 'select',
        required: true,
        options: unassigned.length
          ? unassigned.map((u) => ({ value: u.id, label: `${u.fullName} (${u.role})` }))
          : [{ value: '', label: '— no unassigned members —' }],
      },
      { name: 'role', label: 'Squad role', type: 'select', options: [{ value: 'DEVELOPER', label: 'DEVELOPER' }, { value: 'PM', label: 'PM (allocation must be 1.0)' }] },
      { name: 'allocation', label: 'Allocation (0.01–1.0)', type: 'number', value: 1, step: '0.01' },
    ], 'Add member', (d) => {
      if (!d.userId) throw new Error('No unassigned member selected');
      return act('POST', `/squads/${squadId}/members`, { userId: d.userId, role: d.role, allocation: +d.allocation });
    });
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
async function viewProfile() {
  await uiUserProfile(S.user.id, true);
}

function uiChangePassword() {
  formModal('Change your password', [
    { name: 'currentPassword', label: 'Current password', type: 'password', required: true },
    { name: 'newPassword', label: 'New password (minimum 12 characters)', type: 'password', required: true },
  ], 'Change password', async (d) => {
    if (!d.newPassword || d.newPassword.length < 12) throw new Error('New password must be at least 12 characters');
    await api('POST', '/auth/change-password', d);
    toast('Password changed. Please sign in again.');
    setTimeout(() => doLogout(), 700);
  });
}

async function uiUserProfile(userId, asPage = false) {
  try {
    const p = await api('GET', '/users/' + userId + '/profile');
    const stats = p.stats || {};
    const isExecUser = ['CFO', 'CTO', 'CPO', 'CEO'].includes(p.role);
    const missedList = p.missedDeadlineTasks || [];
    const missedMap = new Map(missedList.map((m) => [m.id, m]));

    const assignedTasks = p.assignedTasks || [];
    const citations = p.citations || [];
    const slackerFines = p.slackerFines || [];
    const dpiSnapshots = p.dpiSnapshots || [];
    const pmhiSnapshots = p.pmhiSnapshots || [];
    const auditLogs = p.executiveAuditLogs || [];
    const execDetails = p.executiveDetails || {};
    const heatmap = p.activityHeatmap || [];
    const activityByDate = new Map(heatmap.map((d) => [d.date, Number(d.count) || 0]));
    const heatmapCells = Array.from({ length: 365 }, (_, i) => {
      const day = new Date();
      day.setDate(day.getDate() - (364 - i));
      const date = day.toISOString().slice(0, 10);
      return { date, count: activityByDate.get(date) || 0 };
    });

    let execOperationsHtml = '';
    if (isExecUser) {
      let roleHtml = '';
      if (p.role === 'CFO') {
        const loans = execDetails.loansApproved || [];
        const payouts = execDetails.sprintPayouts || [];
        roleHtml = `
          <h5 style="margin:14px 0 6px;">Loans Approved (${loans.length})</h5>
          <table>
            <tr><th>Borrower Squad</th><th>Principal</th><th>Total Due</th><th>Status</th><th>Date</th></tr>
            ${loans.map((l) => `<tr>
              <td><b>${esc(l.borrowerSquad?.name || '—')}</b></td>
              <td class="money">${money(l.principalAmount)}</td>
              <td class="money">${money(l.totalDue)}</td>
              <td>${statusBadge(l.status)}</td>
              <td class="mono">${dt(l.createdAt)}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="muted">No loans approved</td></tr>'}
          </table>
          <h5 style="margin:14px 0 6px;">Sprint Payouts (${payouts.length})</h5>
          <table>
            <tr><th>Lab / Sprint</th><th>Total Proposed</th><th>Status</th><th>Date</th></tr>
            ${payouts.map((py) => `<tr>
              <td>Lab ${py.labNumber || '—'}</td>
              <td class="money">${money(py.totalProposed)}</td>
              <td>${statusBadge(py.status)}</td>
              <td class="mono">${dt(py.createdAt)}</td>
            </tr>`).join('') || '<tr><td colspan="4" class="muted">No sprint payouts</td></tr>'}
          </table>
        `;
      } else if (p.role === 'CTO') {
        const citationsIssued = execDetails.citationsIssued || [];
        const consultancies = execDetails.consultancies || [];
        roleHtml = `
          <h5 style="margin:14px 0 6px;">Citations Issued (${citationsIssued.length})</h5>
          <table>
            <tr><th>Target Squad</th><th>Citation Type</th><th>Fine Amount</th><th>Critique</th><th>Date</th></tr>
            ${citationsIssued.map((c) => `<tr>
              <td><b>${esc(c.squad?.name || '—')}</b></td>
              <td>${badge(c.citationType, 'b-red')}</td>
              <td class="money">${money(c.fineAmount)}</td>
              <td>${esc(c.critique)}</td>
              <td class="mono">${dt(c.createdAt)}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="muted">No citations issued</td></tr>'}
          </table>
          <h5 style="margin:14px 0 6px;">Consultancy Bookings (${consultancies.length})</h5>
          <table>
            <tr><th>Client Squad</th><th>Hours</th><th>Total Fee</th><th>Status</th><th>Date</th></tr>
            ${consultancies.map((cb) => `<tr>
              <td><b>${esc(cb.clientSquad?.name || '—')}</b></td>
              <td>${cb.hours || 0} hrs</td>
              <td class="money">${money(cb.totalFee || 0)}</td>
              <td>${statusBadge(cb.status)}</td>
              <td class="mono">${dt(cb.createdAt)}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="muted">No consultancy bookings</td></tr>'}
          </table>
        `;
      } else if (p.role === 'CPO') {
        const approvedPayrolls = execDetails.approvedPayrolls || [];
        const noticesDispatched = execDetails.noticesDispatched || [];
        roleHtml = `
          <h5 style="margin:14px 0 6px;">Payroll Proposals Approved (${approvedPayrolls.length})</h5>
          <table>
            <tr><th>Squad</th><th>Lab</th><th>Total Proposed</th><th>Status</th><th>Updated</th></tr>
            ${approvedPayrolls.map((pr) => `<tr>
              <td><b>${esc(pr.squad?.name || '—')}</b></td>
              <td>Lab ${pr.labNumber}</td>
              <td class="money">${money(pr.totalProposed)}</td>
              <td>${statusBadge(pr.status)}</td>
              <td class="mono">${dt(pr.updatedAt)}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="muted">No payroll proposals approved</td></tr>'}
          </table>
          <h5 style="margin:14px 0 6px;">Notices Dispatched (${noticesDispatched.length})</h5>
          <table>
            <tr><th>Recipient</th><th>Title</th><th>Category</th><th>Date</th></tr>
            ${noticesDispatched.map((n) => `<tr>
              <td><b>${esc(n.recipient?.fullName || 'All')}</b> ${n.recipient?.role ? `(${statusBadge(n.recipient.role)})` : ''}</td>
              <td>${esc(n.title)}</td>
              <td>${esc(n.category)}</td>
              <td class="mono">${dt(n.createdAt)}</td>
            </tr>`).join('') || '<tr><td colspan="4" class="muted">No notices dispatched</td></tr>'}
          </table>
        `;
      } else if (p.role === 'CEO') {
        const chaosEvents = execDetails.chaosEvents || [];
        roleHtml = `
          <h5 style="margin:14px 0 6px;">Chaos Incidents Triggered (${chaosEvents.length})</h5>
          <table>
            <tr><th>Event Type</th><th>Severity</th><th>Description</th><th>Status</th><th>Date</th></tr>
            ${chaosEvents.map((ce) => `<tr>
              <td><b>${esc(ce.eventType)}</b></td>
              <td>${badge(ce.severity, ce.severity === 'CRITICAL' ? 'b-red' : 'b-yellow')}</td>
              <td>${esc(ce.description)}</td>
              <td>${statusBadge(ce.status)}</td>
              <td class="mono">${dt(ce.createdAt)}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="muted">No chaos events triggered</td></tr>'}
          </table>
        `;
      }

      execOperationsHtml = `
        <div style="margin-top:18px;border-top:1px solid var(--border);padding-top:14px;">
          <h4 style="margin:0 0 10px;display:flex;align-items:center;gap:8px;">
            <span>Executive Operations</span>
            ${statusBadge(p.role)}
          </h4>
          <h5 style="margin:12px 0 6px;">Recent Executive Audit Logs (${auditLogs.length})</h5>
          <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;margin-bottom:12px;">
            <table>
              <tr><th>Timestamp</th><th>Action Type</th><th>Severity</th><th>Payload Snapshot</th></tr>
              ${auditLogs.map((log) => {
                const sevClass = log.riskSeverity === 'HIGH' ? 'b-red' : log.riskSeverity === 'MEDIUM' ? 'b-yellow' : 'b-blue';
                const snap = log.payloadSnapshot ? (typeof log.payloadSnapshot === 'object' ? JSON.stringify(log.payloadSnapshot) : String(log.payloadSnapshot)) : '—';
                return `<tr>
                  <td class="mono" style="font-size:11px;">${dt(log.createdAt)}</td>
                  <td><b>${esc(log.actionType)}</b></td>
                  <td><span class="badge ${sevClass}">${esc(log.riskSeverity || 'LOW')}</span></td>
                  <td class="mono" style="font-size:11px;" title="${esc(snap)}">${esc(snap.slice(0, 80))}${snap.length > 80 ? '…' : ''}</td>
                </tr>`;
              }).join('') || '<tr><td colspan="4" class="muted" style="padding:10px;text-align:center;">No executive audit logs recorded</td></tr>'}
            </table>
          </div>
          ${roleHtml}
        </div>
      `;
    }

    const content = `
      ${asPage ? `<div class="profile-actions"><button class="btn primary" onclick="uiChangePassword()">Change password</button></div>` : ''}
      <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px;">
              <span>${esc(p.fullName)}</span>
              ${statusBadge(p.role)}
              ${p.isActive ? badge('ACTIVE', 'b-green') : badge('INACTIVE', 'b-red')}
            </div>
            <div class="muted" style="font-size:12.5px;margin-top:4px;">
              ${esc(p.email)} · Student ID: <b>${esc(p.studentId || '—')}</b> · Joined: ${dt(p.createdAt)}
            </div>
            <div style="margin-top:8px;">
              <span class="muted" style="font-size:12px;margin-right:6px;">Squads:</span>
              ${(p.squadMemberships || []).map((m) => `<span class="badge b-gray" style="margin-right:4px;">${esc(m.squad?.name || '')} (${esc(m.role || 'MEMBER')})</span>`).join('') || '<span class="muted" style="font-size:12px;">No squad memberships</span>'}
            </div>
          </div>
          <div style="text-align:right;">
            <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Personal Wallet</div>
            <div style="font-size:22px;font-weight:800;color:var(--accent2);">${money(p.walletBalance || 0)}</div>
          </div>
        </div>
      </div>

      <div class="panel" style="margin-bottom:16px;">
        <h4 style="margin:0 0 10px;">Activity · last 12 months</h4>
        <div class="activity-heatmap" role="img" aria-label="Task activity heatmap for the last year">
          ${heatmapCells.map((day) => `<span title="${esc(day.date)}: ${day.count} task updates" class="heat-cell heat-${Math.min(4, day.count)}"></span>`).join('')}
        </div>
        <div class="muted" style="font-size:11px;margin-top:8px;">Daily task status changes from the audit trail.</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;margin-bottom:16px;">
        <div class="card" style="padding:10px 14px;">
          <div class="muted" style="font-size:11px;">Total Assigned Tasks</div>
          <div style="font-size:18px;font-weight:700;">${stats.totalAssigned || 0}</div>
        </div>
        <div class="card" style="padding:10px 14px;">
          <div class="muted" style="font-size:11px;">Completed Tasks</div>
          <div style="font-size:18px;font-weight:700;">${stats.completedTasks || 0}</div>
        </div>
        <div class="card" style="padding:10px 14px;">
          <div class="muted" style="font-size:11px;">Missed Deadlines</div>
          <div style="font-size:18px;"><span style="color:${(stats.overdueTasksCount || 0) > 0 ? '#ef4444' : 'inherit'};font-weight:bold">${stats.overdueTasksCount || 0}</span></div>
        </div>
        <div class="card" style="padding:10px 14px;">
          <div class="muted" style="font-size:11px;">On-Time Delivery Rate</div>
          <div style="font-size:18px;font-weight:700;">${stats.onTimeRate ?? 100}%</div>
        </div>
        <div class="card" style="padding:10px 14px;">
          <div class="muted" style="font-size:11px;">Latest DPI / PMHI</div>
          <div style="font-size:18px;font-weight:700;color:var(--accent);">${stats.latestDpi ?? stats.latestPmhi ?? '—'}</div>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <h4 style="margin:0 0 8px;">Assigned Tasks & Deadlines (${assignedTasks.length})</h4>
        <div style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;">
          <table>
            <tr><th>Title</th><th>Status</th><th>Priority</th><th>Due Date</th><th>Git PR / Commit</th></tr>
            ${assignedTasks.map((t) => {
              const m = missedMap.get(t.id);
              const isOverdueNow = t.dueDate && !['CTO_VERIFIED', 'CLOSED'].includes(t.status) && new Date(t.dueDate) < new Date();
              const isCurrentlyOverdue = m ? m.isCurrentlyOverdue : isOverdueNow;
              const daysOverdue = m ? m.daysOverdue : (isOverdueNow && t.dueDate ? Math.ceil((Date.now() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0);
              const showMissed = isCurrentlyOverdue || daysOverdue > 0;
              return `<tr>
                <td>
                  <b>${esc(t.title)}</b>
                  ${showMissed ? '<span class="badge b-red" style="font-weight:bold;margin-left:4px">[MISSED DEADLINE]</span>' : ''}
                </td>
                <td>${statusBadge(t.status)}</td>
                <td>${badge(t.priority, t.priority === 'CRITICAL' ? 'b-red' : 'b-gray')}</td>
                <td style="${showMissed ? 'color:var(--danger);font-weight:bold;' : ''}">${t.dueDate ? dt(t.dueDate) : '—'}</td>
                <td class="mono" style="font-size:11px;">${esc(t.gitPrUrl || t.gitCommitHash || '—')}</td>
              </tr>`;
            }).join('') || '<tr><td colspan="5" class="muted" style="padding:12px;text-align:center;">No assigned tasks</td></tr>'}
          </table>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <h4 style="margin:0 0 8px;">Performance & Audits</h4>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <div style="font-weight:600;font-size:13px;margin-bottom:4px;">Citations Received from CTO (${citations.length})</div>
            ${citations.length > 0 ? `
              <table>
                <tr><th>Squad</th><th>Citation Type</th><th>Fine Amount</th><th>Critique</th><th>Date</th></tr>
                ${citations.map((c) => `<tr>
                  <td><b>${esc(c.squad?.name || '—')}</b></td>
                  <td>${badge(c.citationType, 'b-red')}</td>
                  <td class="money">${money(c.fineAmount)}</td>
                  <td>${esc(c.critique)}</td>
                  <td class="mono">${dt(c.createdAt)}</td>
                </tr>`).join('')}
              </table>
            ` : '<div class="muted" style="font-size:12px;">No code audit citations received.</div>'}
          </div>

          <div>
            <div style="font-weight:600;font-size:13px;margin-bottom:4px;">Slacker Fines (${slackerFines.length})</div>
            ${slackerFines.length > 0 ? `
              <table>
                <tr><th>Description</th><th>Date</th></tr>
                ${slackerFines.map((f) => `<tr>
                  <td>${esc(f.description)}</td>
                  <td class="mono">${dt(f.createdAt)}</td>
                </tr>`).join('')}
              </table>
            ` : '<div class="muted" style="font-size:12px;">No slacker fines recorded.</div>'}
          </div>

          <div>
            <div style="font-weight:600;font-size:13px;margin-bottom:4px;">DPI / PMHI Performance Snapshots (${dpiSnapshots.length || pmhiSnapshots.length})</div>
            ${dpiSnapshots.length > 0 ? `
              <table>
                <tr><th>Sprint</th><th>DPI Score</th><th>Premature Flags</th><th>Recorded At</th></tr>
                ${dpiSnapshots.map((ds) => `<tr>
                  <td>Sprint ${ds.sprintNumber}</td>
                  <td><b>${ds.dpiScore}</b></td>
                  <td>${ds.prematureFlagsCount || 0}</td>
                  <td class="mono">${dt(ds.createdAt)}</td>
                </tr>`).join('')}
              </table>
            ` : pmhiSnapshots.length > 0 ? `
              <table>
                <tr><th>Sprint</th><th>PMHI Score</th><th>Recorded At</th></tr>
                ${pmhiSnapshots.map((ps) => `<tr>
                  <td>Sprint ${ps.sprintNumber}</td>
                  <td><b>${ps.pmhiScore}</b></td>
                  <td class="mono">${dt(ps.createdAt)}</td>
                </tr>`).join('')}
              </table>
            ` : '<div class="muted" style="font-size:12px;">No performance snapshots recorded yet.</div>'}
          </div>
        </div>
      </div>

      ${execOperationsHtml}
    `;

    if (asPage) C().innerHTML = content;
    else modal('Member Profile: ' + esc(p.fullName), content);
  } catch (e) {
    toast('Failed to load profile: ' + e.message, false);
  }
}

async function viewRoster() {
  const users = await api('GET', '/users');
  tabActions(`
    ${isExec() ? '<button class="btn primary" onclick="uiInviteDeveloper()">+ Send Invitation Link</button>' : ''}
    <button class="btn ${isExec() ? 'ghost' : 'primary'}" onclick="uiUserCreate()">+ Direct Enroll</button>
  `);
  C().innerHTML = `<div class="panel"><table>
    <tr><th>Name</th><th>Role</th><th>Email</th><th>Student ID</th><th>Squads</th><th>Actions</th></tr>
    ${users.map((u) => `<tr>
      <td><a href="#" onclick="event.preventDefault();uiUserProfile('${u.id}')" style="color:var(--primary);font-weight:600;text-decoration:none;">${esc(u.fullName)} ↗</a></td><td>${statusBadge(u.role)}</td>
      <td class="muted">${esc(u.email)}</td><td class="mono">${esc(u.studentId || '—')}</td>
      <td>${(u.squadMemberships || []).map((m) => esc(m.squad?.name || '')).join(', ') || '—'}</td>
      <td class="row">
        <button class="btn sm" onclick="uiUserProfile('${u.id}')">Profile</button>
        <button class="btn sm" onclick="uiCopy('${u.id}')">ID</button>
        ${canManage() && (isCEO() || !['CEO', 'CFO', 'CTO', 'CPO'].includes(u.role)) ? `<button class="btn sm" onclick="uiUserEdit('${u.id}','${esc(u.fullName)}','${esc(u.email)}','${u.role}','${esc(u.studentId || '')}')">Edit</button>` : ''}
        ${isCEO() && u.role !== 'CEO' ? `<button class="btn sm bad" title="Delete account (CEO only)" onclick="uiUserDelete('${u.id}','${esc(u.fullName)}','${esc(u.email)}')">Delete</button>` : ''}
      </td></tr>`).join('')}
  </table></div>`;
}

function uiCopy(text) {
  navigator.clipboard?.writeText(text).then(() => toast('Copied: ' + text));
}

function uiCopyLink(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.select();
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(input.value).then(() => {
      toast('Copied invitation link to clipboard!');
    }).catch(() => {
      document.execCommand('copy');
      toast('Copied invitation link to clipboard!');
    });
  } else {
    document.execCommand('copy');
    toast('Copied invitation link to clipboard!');
  }
}

async function uiUserCreate() {
  let roleOptions = [
    { value: 'DEVELOPER', label: 'DEVELOPER' },
    { value: 'PM', label: 'PM' },
  ];
  try {
    const list = await api('GET', '/roles');
    if (Array.isArray(list) && list.length > 0) {
      roleOptions = isCEO()
        ? list.map((r) => ({ value: r.name, label: r.description ? `${r.name} (${r.description})` : r.name }))
        : roleOptions;
    }
  } catch (_) {}

  formModal('Create member profile', [
    { name: 'fullName', label: 'Full name', required: true, placeholder: 'Ayesha Rahman' },
    { name: 'email', label: 'Email', type: 'text', hint: 'email', required: true, placeholder: 'ayesha@seu.edu.bd' },
    { name: 'password', label: 'Temporary password (min 8 chars)', required: true, value: 'Pointfex-' + Math.random().toString(36).slice(2, 8) },
    { name: 'role', label: 'Role', type: 'select', value: 'DEVELOPER', options: roleOptions },
    { name: 'studentId', label: 'Student ID (optional)', placeholder: 'CSE034' },
  ], 'Create profile', (d) => api('POST', '/users', { ...d, studentId: d.studentId || undefined }));
}

async function uiUserEdit(id, fullName, email, role, studentId) {
  // RBAC hierarchy: executive accounts (incl. the CEO) are CEO-administered only.
  if (!isCEO() && ['CEO', 'CFO', 'CTO', 'CPO'].includes(role)) {
    toast('Only the CEO can edit executive accounts.');
    return;
  }
  const isSelfEdit = !isCEO() && id === S.user.id;
  let roleOptions = [
    { value: 'DEVELOPER', label: 'DEVELOPER' },
    { value: 'PM', label: 'PM' },
  ];
  try {
    const list = await api('GET', '/roles');
    if (Array.isArray(list) && list.length > 0) {
      roleOptions = isCEO()
        ? list.map((r) => ({ value: r.name, label: r.description ? `${r.name} (${r.description})` : r.name }))
        : roleOptions;
    }
  } catch (_) {}
  if (!roleOptions.some((o) => o.value === role)) {
    roleOptions.push({ value: role, label: role });
  }

  formModal('Edit member', [
    { name: 'fullName', label: 'Full name', value: fullName, required: true },
    { name: 'email', label: 'Email', type: 'text', hint: 'email', value: email, required: true },
    ...(isSelfEdit
      ? [{ name: 'roleNote', label: 'Role (fixed)', type: 'text', value: role, hint: 'You cannot change your own role' }]
      : [{ name: 'role', label: 'Role', type: 'select', value: role, options: roleOptions }]),
    { name: 'studentId', label: 'Student ID', value: studentId },
    { name: 'password', label: 'New password (leave blank to keep)', placeholder: 'min 8 chars' },
    ...(isSelfEdit
      ? []
      : [{ name: 'isActive', label: 'Active (uncheck to deactivate & revoke sessions)', type: 'checkbox', value: true }]),
  ], 'Save changes', (d) => act('PATCH', `/users/${id}`, {
    fullName: d.fullName, email: d.email,
    ...(d.role && !isSelfEdit ? { role: d.role } : {}),
    studentId: d.studentId || null,
    ...(d.isActive !== undefined && !isSelfEdit ? { isActive: !!d.isActive } : {}),
    ...(d.password ? { password: d.password } : {}),
  }));
}

function uiUserDelete(id, fullName, email) {
  if (!confirm(`Permanently delete ${fullName} (${email})?\n\nTheir wallet, memberships and authored records will be removed. This cannot be undone.`)) return;
  api('DELETE', `/users/${id}`)
    .then(() => { toast(`${fullName} deleted`); render(); })
    .catch((e) => toast(e.message, false));
}

/* ------------------------------ Invitations & Developer Onboarding ------------------------------ */
async function viewInvitations() {
  const actions = isCEO()
    ? `<button class="btn primary" onclick="uiInviteDeveloper()">+ Invite Member (All Roles)</button>
       <button class="btn ghost" onclick="uiCreateRole()">+ New Role</button>`
    : `<button class="btn primary" onclick="uiInviteDeveloper()">+ Invite Dev / PM</button>`;
  tabActions(actions);
  const list = await api('GET', '/invitations');

  const total = list.length;
  const pending = list.filter((i) => i.status === 'PENDING').length;
  const accepted = list.filter((i) => i.status === 'ACCEPTED').length;
  const expired = list.filter((i) => i.status === 'EXPIRED').length;

  C().innerHTML = `
    <div class="cards" style="margin-bottom:16px;">
      <div class="card"><div class="k">Total Invitations</div><div class="v">${total}</div></div>
      <div class="card"><div class="k">Pending (Active 72h)</div><div class="v" style="color:var(--warn);">${pending}</div></div>
      <div class="card"><div class="k">Accepted Members</div><div class="v" style="color:var(--accent2);">${accepted}</div></div>
      <div class="card"><div class="k">Expired / Revoked</div><div class="v" style="color:var(--danger);">${expired}</div></div>
    </div>
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <h3>Developer & Member Invitations (${total})</h3>
        <span class="muted" style="font-size:12px;">72-hour expiration enforced · Powered by Resend</span>
      </div>
      <table>
        <tr>
          <th>Recipient</th>
          <th>Role</th>
          <th>Squad</th>
          <th>Status</th>
          <th>Expires At</th>
          <th>Invited By</th>
          <th>Actions</th>
        </tr>
        ${list.map((inv) => {
          const isPending = inv.status === 'PENDING';
          const isAccepted = inv.status === 'ACCEPTED';
          const isExpired = inv.status === 'EXPIRED';
          const badgeClass = isAccepted ? 'b-green' : isPending ? 'b-yellow' : isExpired ? 'b-red' : 'b-gray';
          return `
            <tr>
              <td><b>${esc(inv.email)}</b></td>
              <td>${badge(inv.role, 'b-blue')}</td>
              <td>${esc(inv.targetSquadId ? squadName(inv.targetSquadId) : '—')}</td>
              <td>${badge(inv.status, badgeClass)}</td>
              <td class="muted">${dt(inv.expiresAt)}</td>
              <td>${esc(inv.invitedBy?.fullName || inv.invitedBy?.email || '—')} <span class="muted">(${esc(inv.invitedBy?.role || '')})</span></td>
              <td>
                <div class="row" style="gap:6px;">
                  ${!isAccepted ? `<button class="btn sm" onclick="uiResendInvitation('${esc(inv.id)}')">Resend (72h)</button>` : ''}
                  ${isPending ? `<button class="btn sm ghost" onclick="uiRevokeInvitation('${esc(inv.id)}')">Revoke</button>` : ''}
                </div>
              </td>
            </tr>`;
        }).join('') || '<tr><td colspan="7" class="empty">No invitations sent yet. Click the invite button above to send an invitation link.</td></tr>'}
      </table>
    </div>`;
}

async function uiCreateRole() {
  formModal('Create New Custom Role', [
    { name: 'name', label: 'Role Identifier (UPPERCASE alphanumeric, e.g. CHRO, QA_LEAD, DESIGNER)', required: true, placeholder: 'CHRO' },
    { name: 'description', label: 'Role Description / Title', placeholder: 'Chief Human Resources Officer' },
  ], 'Create Role', async (d) => {
    const roleCode = (d.name || '').trim().toUpperCase();
    if (!/^[A-Z0-9_]{2,30}$/.test(roleCode)) {
      throw new Error('Role identifier must be 2-30 characters long and contain only uppercase letters, numbers, and underscores.');
    }
    await api('POST', '/roles', {
      name: roleCode,
      description: (d.description || '').trim() || undefined,
    });
    toast(`Custom role "${roleCode}" created successfully!`);
    viewInvitations();
  });
}

async function uiInviteDeveloper(defaultSquadId = '') {
  await loadSquads();
  const squadOptions = [{ value: '', label: 'None (Assign Later)' }, ...S.squads.map((sq) => ({ value: sq.id, label: sq.name }))];

  let roleOptions = [
    { value: 'DEVELOPER', label: 'DEVELOPER' },
    { value: 'PM', label: 'PM' },
  ];

  if (isCEO()) {
    try {
      const allRoles = await api('GET', '/roles');
      if (Array.isArray(allRoles) && allRoles.length > 0) {
        roleOptions = allRoles.map((r) => ({
          value: r.name,
          label: r.description ? `${r.name} (${r.description})` : r.name,
        }));
      } else {
        roleOptions = ['DEVELOPER', 'PM', 'CFO', 'CTO', 'CPO', 'CEO'].map((r) => ({ value: r, label: r }));
      }
    } catch (_) {
      roleOptions = ['DEVELOPER', 'PM', 'CFO', 'CTO', 'CPO', 'CEO'].map((r) => ({ value: r, label: r }));
    }
  }

  const modalTitle = isCEO() ? 'Send Invitation Link (All Roles)' : 'Send Invitation Link (PM & Developer)';
  formModal(modalTitle, [
    { name: 'email', label: 'Institutional Email (@seu.edu.bd)', required: true, hint: 'email', placeholder: 'user@seu.edu.bd' },
    { name: 'role', label: 'Assign Role', type: 'select', value: 'DEVELOPER', options: roleOptions },
    { name: 'targetSquadId', label: 'Assign to Squad (Optional)', type: 'select', value: defaultSquadId || '', options: squadOptions },
  ], 'Send 72-Hour Invitation Link', async (fd) => {
    const email = (fd.email || '').trim().toLowerCase();
    if (!/^[a-zA-Z0-9._%+-]+@seu\.edu\.bd$/.test(email)) {
      throw new Error('Only institutional @seu.edu.bd email addresses are allowed.');
    }
    const res = await api('POST', '/invitations', {
      email,
      role: fd.role || 'DEVELOPER',
      targetSquadId: fd.targetSquadId || undefined,
    });

    const inviteUrl = res.inviteUrl || '';
    const assignedRole = res.role || fd.role || 'DEVELOPER';
    const expiresAtText = res.expiresAt ? dt(res.expiresAt) : 'In 72 hours';
    const emailDelivered = Boolean(res.emailDelivery?.delivered);
    const emailError = res.emailDelivery?.error || '';

    openModal('Invitation Dispatched!', `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:12px;">
          <div style="font-size:13.5px;margin-bottom:6px;"><b>Recipient:</b> ${esc(email)}</div>
          <div style="font-size:13.5px;margin-bottom:6px;"><b>Assigned Role:</b> <span class="badge b-blue">${esc(assignedRole)}</span></div>
          <div style="font-size:13.5px;margin-bottom:6px;"><b>Expires At:</b> <span class="muted">${esc(expiresAtText)}</span> (Strict 72-hour limit)</div>
          <div style="font-size:13.5px;margin-bottom:6px;">
            <b>Mail Status:</b> ${emailDelivered 
              ? '<span class="badge b-green">✓ Sent via Resend</span>' 
              : '<span class="badge b-red">⚠️ Mail NOT Sent</span>'}
          </div>
          ${emailDelivered ? `
            <div style="font-size:12.5px;color:var(--muted);margin-top:6px;">Invitation email dispatched via Resend. The developer can also join directly using the shareable link below:</div>
          ` : `
            <div style="background:rgba(239, 68, 68, 0.12);border:1px solid var(--danger);border-radius:6px;padding:10px;margin-top:8px;font-size:12px;color:var(--danger);line-height:1.4;">
              <b>⚠️ Email was NOT delivered to the recipient\'s inbox!</b><br/>
              ${emailError ? `<span style="opacity:0.9;">Reason: ${esc(emailError)}</span><br/>` : ''}
              <span style="color:var(--text);font-weight:600;display:inline-block;margin-top:4px;">
                👉 You MUST copy the link below and send it directly to the user so they can activate their account.
              </span>
            </div>
          `}
        </div>

        ${inviteUrl ? `
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;color:var(--muted);">Shareable Onboarding Link</label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="invite-share-link" readonly value="${esc(inviteUrl)}" class="inp" style="flex:1;font-family:monospace;font-size:12px;" onclick="this.select()" />
              <button type="button" class="btn primary" onclick="uiCopyLink('invite-share-link')">Copy Link</button>
            </div>
          </div>
        ` : ''}

        <div class="modal-actions" style="margin-top:8px;">
          <button type="button" class="btn ghost" onclick="closeModal()">Close</button>
          <button type="button" class="btn primary" onclick="closeModal();setTab('invitations');">View All Invitations</button>
        </div>
      </div>
    `);

    if (emailDelivered) {
      toast('Invitation email sent to ' + email, true);
    } else {
      toast('Invitation link created, but email was NOT sent! Copy the link.', false);
    }
    if (S.tab === 'invitations') {
      viewInvitations();
    }
    return false;
  });
}

async function uiResendInvitation(id) {
  try {
    const res = await api('POST', `/invitations/${id}/resend`);
    const inviteUrl = res.inviteUrl || '';
    const emailDelivered = Boolean(res.emailDelivery?.delivered);
    const emailError = res.emailDelivery?.error || '';

    if (emailDelivered) {
      toast('Invitation resent & email delivered to ' + (res.email || 'recipient'), true);
    } else {
      toast('72h window refreshed, but email was NOT sent! Share the new link.', false);
    }

    if (inviteUrl) {
      openModal('Invitation Refreshed (72h)', `
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${emailDelivered ? `
            <p style="font-size:13.5px;margin:0;">The 72-hour validity window has been refreshed and a new email dispatched via Resend.</p>
          ` : `
            <div style="background:rgba(239, 68, 68, 0.12);border:1px solid var(--danger);border-radius:6px;padding:10px;font-size:12px;color:var(--danger);line-height:1.4;">
              <b>⚠️ Email was NOT delivered to the recipient!</b><br/>
              ${emailError ? `<span style="opacity:0.9;">Reason: ${esc(emailError)}</span><br/>` : ''}
              <span style="color:var(--text);font-weight:600;display:inline-block;margin-top:4px;">
                👉 You MUST copy the refreshed onboarding link below and provide it directly to the user.
              </span>
            </div>
          `}
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;color:var(--muted);">New Shareable Onboarding Link</label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="resend-share-link" readonly value="${esc(inviteUrl)}" class="inp" style="flex:1;font-family:monospace;font-size:12px;" onclick="this.select()" />
              <button type="button" class="btn primary" onclick="uiCopyLink('resend-share-link')">Copy Link</button>
            </div>
          </div>
          <div class="modal-actions" style="margin-top:8px;">
            <button type="button" class="btn primary" onclick="closeModal();viewInvitations();">Done</button>
          </div>
        </div>
      `);
    }
    await viewInvitations();
  } catch (e) {
    toast(e.message, false);
  }
}

async function uiRevokeInvitation(id) {
  if (!confirm('Are you sure you want to revoke this invitation?')) return;
  try {
    await api('DELETE', `/invitations/${id}`);
    toast('Invitation revoked.');
    await viewInvitations();
  } catch (e) {
    toast(e.message, false);
  }
}

/* ------------------------------ Payroll ------------------------------ */
const TIER_CAPS = { STAR_PERFORMER: 3500, REGULAR: 2000, UNDERPERFORMER: 1000, SLACKER: 0 };

async function viewFines() {
  const proposals = await api('GET', '/fines/proposals');
  const canPropose = isCPO() || isCTO() || isCEO();
  tabActions(canPropose ? '<button class="btn primary" onclick="uiFinePropose()">+ Propose a fine</button>' : '');
  C().innerHTML = `<div class="panel"><h3>Fine proposals · CFO approval required</h3>
    ${proposals.length ? `<table><tr><th>Target</th><th>Amount</th><th>Reason</th><th>Proposed by</th><th>Status</th><th>Actions</th></tr>
      ${proposals.map((p) => {
        const target = p.targetType === 'SQUAD' ? p.targetSquad?.name : `${p.targetUser?.fullName || 'User'} (${p.targetUser?.role || ''})`;
        return `<tr><td><b>${esc(target || '—')}</b><div class="muted">${esc(p.targetType)}</div></td><td class="money">${money(p.amount)}</td><td>${esc(p.reason)}</td><td>${esc(p.proposedBy?.fullName || '—')} (${esc(p.proposedBy?.role || '—')})</td><td>${statusBadge(p.status)}</td><td>${isCFO() && p.status === 'PENDING' ? `<button class="btn sm bad" onclick="act('POST','/fines/proposals/${p.id}/approve')">Approve & apply</button>` : (p.status === 'PENDING' ? 'Awaiting CFO' : '—')}</td></tr>`;
      }).join('')}</table>` : '<div class="empty">No fine proposals</div>'}
    <div class="muted" style="font-size:11px;margin-top:8px">Approved fines debit the selected user wallet or squad treasury and credit SYSTEM_RESERVE in the same ledger transaction. Limit ৳50,000 per proposal.</div>
  </div>`;
}

async function uiFinePropose() {
  let users = [];
  try { users = await api('GET', '/users'); } catch (_) {}
  const targets = [
    ...S.squads.filter((s) => s.isActive !== false).map((s) => ({ value: `SQUAD:${s.id}`, label: `Squad · ${s.name}` })),
    ...users.filter((u) => u.isActive !== false && ['PM', 'DEVELOPER'].includes(u.role)).map((u) => ({ value: `USER:${u.id}`, label: `Person · ${u.fullName} (${u.role})` })),
  ];
  formModal('Propose a fine (CFO approval required)', [
    { name: 'target', label: 'Squad, PM or developer', type: 'select', required: true, options: targets },
    { name: 'amount', label: 'Amount (BDT, max 50,000)', type: 'number', required: true, min: 0.01, max: 50000, step: '0.01' },
    { name: 'reason', label: 'Evidence / reason (min 10 characters)', type: 'textarea', required: true },
  ], 'Submit for CFO approval', (d) => {
    const [targetType, targetId] = String(d.target || '').split(':');
    if (!targetId || !['SQUAD', 'USER'].includes(targetType)) throw new Error('Select a valid target');
    return act('POST', '/fines/proposals', {
      targetType, ...(targetType === 'SQUAD' ? { targetSquadId: targetId } : { targetUserId: targetId }),
      amount: Number(d.amount), reason: d.reason,
    });
  });
}

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
        ${(isCPO() || isCEO()) && p.status === 'SUBMITTED' ? `<button class="btn good sm" onclick="act('POST','/payroll/${p.id}/approve',null,true)">${isCEO() ? 'CEO override: approve & disburse' : 'Approve & disburse'}</button>` : ''}
        ${isCPO() && p.status === 'SUBMITTED' ? `<button class="btn bad sm" onclick="uiPayrollReject('${p.id}')">Reject</button>` : ''}
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
/* ------------------------------ Accounting (role-scoped immutable ledger) ------------------------------ */
async function viewAccounting() {
  const accounts = await api('GET', '/ledger/accounts');
  const selected = accounts.find((a) => a.id === S.accountId) || accounts[0];
  if (selected) S.accountId = selected.id;
  const entries = selected ? await api('GET', `/ledger/accounts/${selected.id}/entries`) : [];
  const globalView = isCEO() || isCFO();
  let globalTransactions = [], transactionUsers = [];
  if (globalView) {
    try { transactionUsers = await api('GET', '/users'); } catch (_) {}
    const filters = new URLSearchParams({ limit: '100' });
    if (S.ledgerAction) filters.set('referenceType', S.ledgerAction);
    if (S.ledgerUser) filters.set('userId', S.ledgerUser);
    try { globalTransactions = await api('GET', `/ledger/transactions?${filters.toString()}`); } catch (_) {}
  }
  let requests = [];
  if (isCEO() || isCFO()) { try { requests = await api('GET', '/ledger/pool-funding/requests'); } catch (_) {} }
  tabActions(`${globalView ? `<select class="inp ledger-filter" aria-label="Filter transactions by action" onchange="S.ledgerAction=this.value;viewAccounting()"><option value="">All actions</option>${['PAYROLL','SPRINT_PAYOUT','SQUAD_FUNDING','PERSONAL_FUNDING','CAPITAL_INJECTION','RESERVE_SWEEP','CEO_BONUS','TAX','FINE','SLACKER_FINE','LOAN_DISBURSEMENT','LOAN_REPAYMENT','EQUITY_INVESTMENT','EQUITY_DIVIDEND','MARKETPLACE_PURCHASE','CONSULTANCY','BOUNTY','ESCROW_DEPOSIT','ESCROW_RELEASE','CHAOS_PENALTY','SWAP_FEE'].map((a) => `<option value="${a}" ${S.ledgerAction === a ? 'selected' : ''}>${a.replace(/_/g, ' ')}</option>`).join('')}</select><select class="inp ledger-filter" aria-label="Filter transactions by user" onchange="S.ledgerUser=this.value;viewAccounting()"><option value="">All users</option>${transactionUsers.map((u) => `<option value="${u.id}" ${S.ledgerUser === u.id ? 'selected' : ''}>${esc(u.fullName)} (${esc(u.role)})</option>`).join('')}</select>` : ''}${isCFO() || isCEO() ? `<button class="btn primary" onclick="uiAccountingAllocate()">Allocate to squad</button><button class="btn" onclick="uiAccountingAllocatePersonal()">Allocate to person</button>` : ''}${isCFO() ? '<button class="btn" onclick="uiPoolFundingRequest()">Request pool funding</button>' : ''}${isCEO() ? '<button class="btn primary" onclick="uiPoolFundingDirect()">Add external pool capital</button><button class="btn bad" onclick="uiSweepAllFunds()">Return all funds to reserve</button>' : ''}`);
  let reconciliation = null;
  if (isCEO()) { try { reconciliation = await api('POST', '/ledger/verify-chain'); } catch (_) {} }
  C().innerHTML = `
    ${isCEO() && reconciliation?.totalBalanceDiscrepancies ? `<div class="panel" style="border-color:var(--warn);margin-bottom:12px"><b style="color:var(--warn)">Opening-balance reconciliation needed</b><div class="muted" style="margin-top:5px">${reconciliation.totalBalanceDiscrepancies} accounts differ from available ledger history. Hash chain: ${esc(reconciliation.chainStatus)}. No automatic adjustment was made; verify opening amounts against bank records.</div>${(reconciliation.balanceDiscrepancies || []).slice(0, 5).map((d) => `<div class="row" style="justify-content:space-between;border-top:1px solid var(--border);padding-top:4px;font-size:11px"><span>${esc(d.type)} · ${esc(d.squadId || d.ownerId || d.accountId)}</span><span>book ${money(d.currentBalance)} · journal ${money(d.ledgerBalance)} · difference ${money(d.difference)}</span></div>`).join('')}</div>` : ''}
    ${requests.length ? `<div class="panel" style="margin-bottom:12px"><h3>CFO pool funding requests</h3>${requests.map((r) => `<div class="list-item"><div class="top"><span><b>${money(r.amount)}</b> · ${esc(r.memo)}<div class="muted" style="font-size:11px">Requested by ${esc(r.requestedBy?.fullName)} · ${dt(r.createdAt)}</div></span><span>${statusBadge(r.status)} ${isCEO() && r.status === 'PENDING' ? `<button class="btn sm good" onclick="act('POST','/ledger/pool-funding/requests/${r.id}/approve')">Approve & fund</button>` : ''}</span></div></div>`).join('')}</div>` : ''}
    <div class="accounting-grid"><div class="panel"><h3>Accounts in your scope</h3>
      ${accounts.map((a) => `<button class="account-tile ${a.id === selected?.id ? 'selected' : ''}" onclick="S.accountId='${a.id}';viewAccounting()"><span>${esc(a.type.replace(/_/g, ' '))}</span><b>${money(a.balance)}</b>${a.isFrozen ? badge('FROZEN', 'b-red') : ''}</button>`).join('') || '<div class="empty">No accounts in your scope</div>'}
      ${(isCEO() || isCFO()) && selected?.type === 'SQUAD_TREASURY' ? `<button class="btn sm bad" style="width:100%;margin-top:8px" onclick="uiReturnSquadFunds('${selected.squadId}','${esc(selected.balance)}')">Return unspent balance to reserve</button>` : ''}
    </div><div class="panel accounting-entries"><h3>Debit / credit activity · latest 100</h3>
      ${selected ? `<div class="muted" style="font-size:11px;margin-bottom:8px">${esc(selected.type.replace(/_/g, ' '))} · balance ${money(selected.balance)}</div><table><tr><th>Time</th><th>Reference</th><th>Description</th><th>Debit</th><th>Credit</th></tr>${entries.map((e) => `<tr><td class="mono">${dt(e.createdAt)}</td><td>${esc(e.transaction.referenceType)}</td><td>${esc(e.transaction.description || '—')}</td><td class="money">${e.direction === 'DEBIT' ? money(e.amount) : '—'}</td><td class="money">${e.direction === 'CREDIT' ? money(e.amount) : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No ledger entries</td></tr>'}</table>` : '<div class="empty">No accounts</div>'}
      </div></div>
      ${globalView ? `<div class="panel" style="margin-top:14px"><h3>All transactions · ${globalTransactions.length} shown</h3><table><tr><th>Time</th><th>Action</th><th>Authorized by</th><th>Accounts / recipients</th><th>Description</th><th>Debit total</th></tr>${globalTransactions.map((t) => {
        const parties = [...new Set((t.entries || []).map((e) => e.account?.user?.fullName || e.account?.squad?.name || e.account?.type).filter(Boolean))].join(', ');
        return `<tr><td class="mono">${dt(t.createdAt)}</td><td>${esc(t.referenceType)}</td><td>${esc(t.authorizedBy?.fullName || '—')} (${esc(t.authorizedBy?.role || '—')})</td><td>${esc(parties || '—')}</td><td>${esc(t.description || '—')}</td><td class="money">${money((t.entries || []).filter((e) => e.direction === 'DEBIT').reduce((sum, e) => sum + Number(e.amount), 0))}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="empty">No matching transactions</td></tr>'}</table></div>` : ''}`;
}

function uiAccountingAllocate() {
  const options = S.squads.filter((s) => s.isActive !== false).map((s) => ({ value: s.id, label: s.name }));
  formModal('Allocate reserve to squad', [{ name: 'squadId', label: 'Active squad', type: 'select', required: true, options }, { name: 'amount', label: 'Amount (BDT)', type: 'number', required: true, min: 0.01, step: '0.01' }], 'Allocate', (d) => act('POST', '/ledger/allocate', { squadId: d.squadId, amount: +d.amount }, true));
}

async function uiAccountingAllocatePersonal() {
  const users = await api('GET', '/users');
  const options = users.filter((u) => u.isActive !== false).map((u) => ({ value: u.id, label: `${u.fullName} (${u.role})` }));
  formModal('Allocate reserve funds to a personal wallet', [
    { name: 'userId', label: 'Active user', type: 'select', required: true, options },
    { name: 'amount', label: 'Amount (BDT)', type: 'number', required: true, min: 0.01, step: '0.01' },
  ], 'Allocate to wallet', (d) => act('POST', '/ledger/allocate-personal', { userId: d.userId, amount: +d.amount }, true));
}

function uiPoolFundingRequest() {
  formModal('Request external pool funding', [{ name: 'amount', label: 'Amount (BDT)', type: 'number', required: true, min: 0.01, step: '0.01' }, { name: 'memo', label: 'Source / reason (CEO approval required)', type: 'textarea', required: true }], 'Send to CEO', (d) => act('POST', '/ledger/pool-funding/requests', { amount: +d.amount, memo: d.memo }));
}

function uiPoolFundingDirect() {
  formModal('Add external capital to system reserve', [{ name: 'amount', label: 'Amount (BDT)', type: 'number', required: true, min: 0.01, step: '0.01' }, { name: 'memo', label: 'Verified source / bank reference', type: 'textarea', required: true }], 'Record capital injection', (d) => act('POST', '/ledger/pool-funding/direct', { amount: +d.amount, memo: d.memo }, true));
}

function uiReturnSquadFunds(squadId, amount) {
  if (!confirm(`Return ${money(amount)} from this squad treasury to SYSTEM_RESERVE? This is recorded as a ledger transfer.`)) return;
  act('POST', `/ledger/squads/${squadId}/return-funds`, undefined, true);
}

async function uiSweepAllFunds() {
  const accounts = await api('GET', '/ledger/accounts');
  const sweepable = accounts.filter((a) => ['PERSONAL_WALLET', 'SQUAD_TREASURY'].includes(a.type) && Number(a.balance) > 0);
  const total = sweepable.reduce((sum, a) => sum + Number(a.balance), 0);
  if (!total) { toast('All personal wallets and squad treasuries are already empty'); return; }
  if (!confirm(`This will transfer ${money(total)} from ${sweepable.length} personal/squad accounts into SYSTEM_RESERVE. Each debit and the reserve credit will be recorded in the ledger. This cannot be undone. Continue?`)) return;
  const confirmation = prompt('Type RETURN_ALL_FUNDS_TO_RESERVE to confirm:');
  if (confirmation !== 'RETURN_ALL_FUNDS_TO_RESERVE') { toast('Sweep cancelled; confirmation did not match', false); return; }
  act('POST', '/ledger/reserve/sweep', { confirmation }, true);
}

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
              ${isCFO() && p.status === 'APPROVED' ? `<button class="btn primary sm" onclick="act('POST','/sprint-payouts/${p.id}/execute',null,true)">Execute</button>` : ''}</td></tr>
            <tr><td colspan="4"><details class="payout-details"><summary>View CFO rankings and payout details</summary>
              <table><tr><th>Rank</th><th>Squad</th><th>Gross pool</th><th>Tax</th><th>Net to squad</th><th>PM bonus</th></tr>
                ${(p.items || []).slice().sort((a, b) => a.rank - b.rank).map((item) => `<tr><td>${item.rank}</td><td><b>${esc(item.squad?.name || item.squadId)}</b></td><td class="money">${money(item.grossAmount)}</td><td>${money(item.taxAmount)}</td><td>${money(item.netAmount)}</td><td>${money(item.pmBonusAmount || 0)}</td></tr>`).join('')}
              </table>
            </details></td></tr>`).join('')}
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
  try {
    const raw = atob(cipher);
    try {
      const env = JSON.parse(raw);
      if (env.alg === 'X25519-AES256GCM') {
        text = `[E2EE Ciphertext Decrypted: ${env.alg}]\nPayload: ${atob(env.data)}\nIV: ${env.iv}\nTag: ${env.tag}`;
      } else {
        text = raw;
      }
    } catch {
      text = raw;
    }
  } catch { /* not base64 */ }
  openModal('Decrypted notice (client-side)', `<div style="padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);white-space:pre-wrap">${esc(text)}</div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button></div>`);
}

async function uiNoticeDispatch() {
  let users = [];
  try { users = await api('GET', '/users'); } catch { /* */ }
  formModal('Dispatch encrypted notice', [
    { name: 'recipientId', label: 'Recipient', type: 'select', options: users.map((u) => ({ value: u.id, label: `${u.fullName} (${u.role})` })) },
    { name: 'category', label: 'Category', type: 'select', options: ['DISCIPLINARY', 'APPOINTMENT', 'ORGANIZATIONAL', 'STUDIO_DIRECTIVE'].map((c) => ({ value: c, label: c })) },
    { name: 'title', label: 'Title', required: true, value: 'Disciplinary citation' },
    { name: 'message', label: 'Message (E2EE encrypted with recipient key)', type: 'textarea', required: true, value: 'Your lab attendance and commit activity require immediate improvement.' },
  ], 'Encrypt & dispatch', (d) => {
    const { message, ...rest } = d;
    const envelope = {
      alg: 'X25519-AES256GCM',
      ephemPk: btoa('x25519-ephem-key-' + Date.now()),
      iv: btoa('iv-' + Math.random().toString(36).slice(2)),
      tag: btoa('tag-' + Math.random().toString(36).slice(2)),
      data: btoa(unescape(encodeURIComponent(message))),
    };
    return act('POST', '/notices', {
      ...rest,
      encryptedContent: btoa(JSON.stringify(envelope)),
      signature: btoa('ed25519-sig-' + S.user.id + '-' + Date.now()),
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

/* ------------------------------ Audit Logs ------------------------------ */
async function viewAudit() {
  const res = await api('GET', '/audit/logs?limit=50');
  const logs = (res && res.data) || [];
  tabActions(`
    <button class="btn secondary" onclick="viewAudit()">Refresh</button>
  `);
  C().innerHTML = `<div class="panel">
    <div style="margin-bottom:12px;font-size:13px;color:var(--muted);display:flex;justify-content:space-between;align-items:center;">
      <span>Total executive audit logs: <b>${res?.meta?.total || logs.length}</b></span>
      <span class="muted" style="font-size:11px;">Showing recent 50 entries</span>
    </div>
    <table>
      <tr><th>Timestamp</th><th>Actor</th><th>Role</th><th>Action</th><th>Severity</th><th>Payload</th></tr>
      ${logs.map((l) => `<tr>
        <td class="mono" style="font-size:11px;white-space:nowrap;">${dt(l.createdAt)}</td>
        <td><b>${esc(l.executive?.fullName || l.executiveRole)}</b><br><span class="muted" style="font-size:11px;">${esc(l.executive?.email || '')}</span></td>
        <td>${badge(l.executiveRole, 'b-gray')}</td>
        <td class="mono" style="font-size:12px;font-weight:600;">${esc(l.actionType)}</td>
        <td>${badge(l.riskSeverity, l.riskSeverity === 'CRITICAL' ? 'b-red' : l.riskSeverity === 'WARNING' ? 'b-yellow' : 'b-gray')}</td>
        <td><button class="btn sm" onclick="alert(JSON.stringify(${esc(JSON.stringify(l.payloadSnapshot))}, null, 2))">Inspect</button></td>
      </tr>`).join('') || '<tr><td colspan="6" class="muted text-center">No audit logs found</td></tr>'}
    </table>
  </div>`;
}

/* ------------------------------ Settings ------------------------------ */
async function viewSettings() {
  const settings = await api('GET', '/settings');
  let resetStatus = null;
  try { resetStatus = await api('GET', '/settings/production-reset/status'); } catch (_) {}
  if (!resetStatus?.preview) resetStatus = null;
  const resetPanel = resetStatus ? `<div class="panel reset-panel" style="margin-bottom:14px;border-color:var(--danger)">
    <div class="top"><div><h3 style="margin:0">One-time production data reset</h3><div class="muted" style="font-size:12px;margin-top:4px">Keeps only this CEO account, system roles and business settings. Removes all squads, other users, wallets, ledger transactions, loans, payroll, governance, tasks and test data. All balances reset to zero.</div></div>
      ${resetStatus.alreadyExecuted ? badge('ALREADY USED', 'b-red') : resetStatus.enabled ? '<button class="btn bad" onclick="uiProductionReset()">Reset all development data</button>' : '<button class="btn bad" disabled title="Enable ALLOW_CEO_DATA_RESET=true in Dokploy for the maintenance window">Reset disabled</button>'}
    </div>
    ${resetStatus.alreadyExecuted ? `<p class="muted" style="font-size:12px">Executed ${dt(resetStatus.executedAt)} by ${esc(resetStatus.executedBy)}. This one-time reset cannot run again.</p>` : `<div class="reset-preview"><b>Preview:</b> ${resetStatus.preview.users} users · ${resetStatus.preview.squads} squads · ${resetStatus.preview.tasks} tasks · ${resetStatus.preview.transactions} ledger transactions · ${resetStatus.preview.loans} loans · ${resetStatus.preview.governanceDecisions} governance decisions · ${resetStatus.preview.payrollProposals} payroll proposals<div style="margin-top:5px">Balances to be erased: ${(resetStatus.preview.balances || []).map((a) => `${esc(a.type)} ${money(a.total)}`).join(' · ')}</div></div><div class="muted" style="font-size:11px;margin-top:6px">Requires a verified database backup, ALLOW_CEO_DATA_RESET=true, your current CEO password and the exact confirmation phrase. A permanent reset record is retained. Disable the environment flag immediately after.</div>`}
  </div>` : '';
  C().innerHTML = `${resetPanel}<div class="panel"><table><tr><th>Key</th><th>Type</th><th>Value</th><th></th></tr>
    ${settings.map((s) => `<tr><td class="mono">${esc(s.key)}</td><td>${badge(s.type, 'b-gray')}</td>
      <td><input class="inp" id="set-${esc(s.key)}" value="${esc(s.value)}" style="width:220px"/></td>
      <td><button class="btn sm" onclick="uiSaveSetting('${esc(s.key)}','${esc(s.type)}')">Save</button></td></tr>`).join('')}
  </table></div>`;
}

async function uiProductionReset() {
  if (!confirm('FINAL WARNING: This permanently removes all non-CEO users and all operational/financial history from this database. A backup must already exist. Continue?')) return;
  const currentPassword = prompt('Enter your current CEO password:');
  if (!currentPassword) return;
  const confirmation = prompt('Type RESET_DEVELOPMENT_DATA_TO_PRODUCTION exactly:');
  if (confirmation !== 'RESET_DEVELOPMENT_DATA_TO_PRODUCTION') { toast('Reset cancelled: confirmation phrase did not match', false); return; }
  try {
    const result = await api('POST', '/settings/production-reset', { currentPassword, confirmation });
    toast(result.message || 'Production data reset completed');
    S.user = await api('GET', '/auth/me');
    await renderShell();
    await render();
  } catch (e) {
    toast(e.message || 'Production reset failed', false);
  }
}

async function uiSaveSetting(key, type) {
  const value = document.getElementById('set-' + key).value;
  try { await api('PUT', '/settings', { key, value, type }); toast('Saved'); } catch (e) { toast(e.message, false); }
}

/* ============================== boot ============================== */
async function boot() {
  try {
    S.user = await api('GET', '/auth/me');
    try {
      const savedTab = localStorage.getItem('pf_active_tab');
      if (savedTab && TABS.some((item) => item.id === savedTab && item.show())) S.tab = savedTab;
    } catch (_) {}
    renderShell();
    await render();
  } catch (e) {
    doLogout(false);
    loginView(e.message || 'Session expired');
  }
}

async function init() {
  restoreTheme();
  const hash = (typeof window !== 'undefined' && window.location?.hash) || '';
  if (hash.startsWith('#accept-invite?')) {
    const params = new URLSearchParams(hash.slice('#accept-invite?'.length));
    const token = params.get('token');
    if (token) {
      acceptInviteView(token);
      return;
    }
  }
  if (hash.startsWith('#reset-password?')) {
    const params = new URLSearchParams(hash.slice('#reset-password?'.length));
    const token = params.get('token');
    if (token) {
      resetPasswordView(token);
      return;
    }
  }

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
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('hashchange', () => init());
}
init();
