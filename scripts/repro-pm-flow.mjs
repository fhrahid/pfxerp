/* Reproduce the reported production issue: fresh bootstrap DB, C-level builds
 * the studio via CRUD, PM creates a task + payroll — do they show up? */
const BASE = 'http://localhost:3000/api/v1';
async function raw(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: json?.data, error: json?.error };
}
const login = async (email, password) => (await raw('POST', '/auth/login', { email, password })).data;

const ceo = await login('noor@seu.edu.bd', 'PointfexCeo2026!');
const ceoTok = ceo.accessToken;

// C-level builds studio exactly like the user did
const created = await raw('POST', '/squads', { name: 'Squad Web', initialBalance: 100000 }, ceoTok);
console.log('create squad:', created.status, created.data?.id ?? created.error?.message);
const squads = (await raw('GET', '/squads', undefined, ceoTok)).data;
console.log('squads list:', Array.isArray(squads) ? squads.length : 'undefined');
const squad = squads.find((s) => s.name === 'Squad Web');

const pm = (await raw('POST', '/users', { email: 'pm@pfx.dev', fullName: 'Test PM', password: 'Pointfex-123', role: 'PM' }, ceoTok)).data;
const dev = (await raw('POST', '/users', { email: 'dev@pfx.dev', fullName: 'Test Dev', password: 'Pointfex-123', role: 'DEVELOPER' }, ceoTok)).data;
await raw('POST', `/squads/${squad.id}/members`, { userId: pm.id, role: 'PM', allocation: 1 }, ceoTok);
await raw('POST', `/squads/${squad.id}/members`, { userId: dev.id, role: 'DEVELOPER', allocation: 1 }, ceoTok);

// PM logs in and works
const pmSess = await login('pm@pfx.dev', 'Pointfex-123');
console.log('PM auth/me squadIds:', pmSess.user.squadIds?.length, 'memberships:', pmSess.user.squadMemberships?.length);

const task = await raw('POST', '/tasks', { squadId: squad.id, title: 'First task', storyPoints: 3, sprintNumber: 1, assignedToId: dev.id }, pmSess.accessToken);
console.log('create task:', task.status, task.data?.status ?? task.error?.message);

const list = await raw('GET', `/tasks?squadId=${squad.id}`, undefined, pmSess.accessToken);
console.log('PM sees tasks:', Array.isArray(list.data) ? list.data.length : list.status, list.error?.message || '');

const detail = await raw('GET', `/squads/${squad.id}`, undefined, pmSess.accessToken);
console.log('squad members:', detail.data?.members?.map((m) => m.role).join(',') || detail.error?.message);

const pay = await raw('POST', '/payroll', { squadId: squad.id, labNumber: 1, lineItems: [{ userId: dev.id, tier: 'REGULAR', amount: 2000 }] }, pmSess.accessToken);
console.log('create payroll:', pay.status, pay.data?.status ?? pay.error?.message);

const payList = await raw('GET', '/payroll', undefined, pmSess.accessToken);
console.log('PM sees payrolls:', Array.isArray(payList.data) ? payList.data.length : payList.status, payList.error?.message || '');
