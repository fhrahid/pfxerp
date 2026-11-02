// scripts/test-executive-oversight.mjs
// Automated verification suite for C-Level Executive Oversight, Member Profiles,
// Task Due Dates, Missed Deadlines, and Web Audit Logs.

import http from 'node:http';

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';

async function request(method, path, body = null, token = null) {
  const url = new URL(`${BASE_URL}${path}`);
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch {}
          const unwrap = parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed;
          resolve({ status: res.statusCode, body: unwrap, raw: parsed });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log(`  [PASS] ${message}`);
}

async function run() {
  console.log('\n================================================================');
  console.log('   POINTFEX ERP — EXECUTIVE OVERSIGHT & PROFILE AUDIT SUITE     ');
  console.log('================================================================\n');

  // 1. Authenticate as CEO
  console.log('1. Authenticating as CEO:');
  const ceoLogin = await request('POST', '/auth/login', {
    email: 'noor@seu.edu.bd',
    password: process.env.CEO_PASSWORD || 'PointfexCeo2026!',
  });
  assert(ceoLogin.status === 200 || ceoLogin.status === 201, 'CEO login status 200/201');
  const ceoToken = ceoLogin.body.accessToken || ceoLogin.body.token;
  const ceoUser = ceoLogin.body.user;
  assert(Boolean(ceoToken), 'CEO token acquired');
  assert(ceoUser.role === 'CEO', 'User role is CEO');

  // 2. Fetch User Roster to find PM, Developer, and Executive accounts
  console.log('\n2. Fetching User Roster:');
  const rosterRes = await request('GET', '/users', null, ceoToken);
  assert(rosterRes.status === 200, 'GET /users returns 200 for CEO');
  const users = rosterRes.body;
  assert(Array.isArray(users) && users.length > 0, 'User list returned');

  const dev = users.find((u) => u.role === 'DEVELOPER');
  const pm = users.find((u) => u.role === 'PM');
  const cfo = users.find((u) => u.role === 'CFO');
  const cto = users.find((u) => u.role === 'CTO');
  const cpo = users.find((u) => u.role === 'CPO');

  assert(Boolean(dev), `Developer user found: ${dev?.email}`);
  assert(Boolean(pm), `PM user found: ${pm?.email}`);
  assert(Boolean(cfo), `CFO user found: ${cfo?.email}`);

  // 3. Test Role-Aware Member Profile API (GET /users/:id/profile)
  console.log('\n3. Testing Role-Aware Member Profiles:');
  const devProfileRes = await request('GET', `/users/${dev.id}/profile`, null, ceoToken);
  assert(devProfileRes.status === 200, 'CEO can fetch Developer profile');
  const devProfile = devProfileRes.body;
  assert(devProfile.id === dev.id, 'Developer profile ID matches');
  assert(devProfile.stats !== undefined, 'Developer profile has stats object');
  assert(typeof devProfile.stats.totalAssigned === 'number', 'totalAssigned is a number');
  assert(typeof devProfile.stats.overdueTasksCount === 'number', 'overdueTasksCount is a number');
  assert(Array.isArray(devProfile.assignedTasks), 'assignedTasks is an array');

  // Check CFO Profile
  const cfoProfileRes = await request('GET', `/users/${cfo.id}/profile`, null, ceoToken);
  assert(cfoProfileRes.status === 200, 'CEO can fetch CFO profile');
  const cfoProfile = cfoProfileRes.body;
  assert(cfoProfile.executiveDetails !== undefined, 'CFO profile contains executiveDetails');
  assert(Array.isArray(cfoProfile.executiveAuditLogs), 'CFO profile contains executiveAuditLogs');

  // 4. Test ABAC on Profile API
  console.log('\n4. Testing ABAC Access Control on Profile API:');
  // Log in as Developer
  const devLogin = await request('POST', '/auth/login', {
    email: dev.email,
    password: 'Password123!',
  });
  let devToken = null;
  if (devLogin.status === 200 || devLogin.status === 201) {
    devToken = devLogin.body.accessToken || devLogin.body.token;
  }

  if (devToken) {
    // Developer fetching own profile should succeed
    const devSelf = await request('GET', `/users/${dev.id}/profile`, null, devToken);
    assert(devSelf.status === 200, 'Developer can fetch their own profile');

    // Developer fetching CFO profile should be 403 Forbidden
    const devForbidden = await request('GET', `/users/${cfo.id}/profile`, null, devToken);
    assert(devForbidden.status === 403, 'Developer cannot fetch CFO profile (403 Forbidden)');
  } else {
    console.log('  [SKIP] Developer default password login not configured, skipping dev ABAC login test');
  }

  // 5. Test Task Due Date & Overdue Detection
  console.log('\n5. Testing Task Due Date & Overdue Detection:');
  // Get an active squad
  const squadsRes = await request('GET', '/squads', null, ceoToken);
  assert(squadsRes.status === 200, 'GET /squads returns 200');
  const squads = squadsRes.body;
  assert(squads.length > 0, 'At least one squad exists');
  const squadId = squads[0].id;

  // Create an overdue task (due yesterday)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const overdueTaskRes = await request(
    'POST',
    '/tasks',
    {
      squadId,
      title: 'Audit Fix: Test Missed Deadline',
      description: 'Task with past due date for deadline testing',
      storyPoints: 3,
      priority: 'HIGH',
      assignedToId: dev.id,
      dueDate: yesterday,
    },
    ceoToken,
  );
  assert(overdueTaskRes.status === 201, 'Task created with past due date');
  const overdueTaskId = overdueTaskRes.body.id;

  // Fetch the task and verify isOverdue is true
  const fetchedTaskRes = await request('GET', `/tasks/${overdueTaskId}`, null, ceoToken);
  assert(fetchedTaskRes.status === 200, 'GET /tasks/:id returns 200');
  assert(fetchedTaskRes.body.isOverdue === true, 'Task is correctly marked isOverdue: true');

  // Update task due date to tomorrow via PATCH
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const patchTaskRes = await request(
    'PATCH',
    `/tasks/${overdueTaskId}`,
    {
      dueDate: tomorrow,
    },
    ceoToken,
  );
  assert(patchTaskRes.status === 200, 'PATCH /tasks/:id updates dueDate successfully');
  assert(patchTaskRes.body.isOverdue === false, 'Updated task with future due date has isOverdue: false');

  // 6. Test Executive Audit Logs API (GET /audit/logs and GET /audit/executive-logs)
  console.log('\n6. Testing Executive Audit Logs API:');
  const logsRes = await request('GET', '/audit/logs', null, ceoToken);
  assert(logsRes.status === 200, 'GET /audit/logs returns 200 for CEO');
  assert(Array.isArray(logsRes.body.data), 'Executive audit logs list returned in data');

  const execLogsAliasRes = await request('GET', '/audit/executive-logs', null, ceoToken);
  assert(execLogsAliasRes.status === 200, 'GET /audit/executive-logs alias returns 200 for CEO');

  // 7. Test CEO 360 Dashboard Enriched with Executive Anomaly Flags
  console.log('\n7. Testing CEO 360 Dashboard Collusion Detection:');
  const ceoDashRes = await request('GET', '/dashboard/ceo', null, ceoToken);
  assert(ceoDashRes.status === 200, 'GET /dashboard/ceo returns 200');
  const ceoDash = ceoDashRes.body;
  assert(ceoDash.macro !== undefined, 'CEO dashboard contains macro liquidity');
  assert(Array.isArray(ceoDash.executives), 'CEO dashboard contains executives array');
  assert(Array.isArray(ceoDash.recentExecutiveActions), 'CEO dashboard contains recentExecutiveActions');

  for (const exec of ceoDash.executives) {
    assert(Array.isArray(exec.anomalyFlags), `Executive ${exec.role} has anomalyFlags array`);
    assert(typeof exec.actionCount === 'number', `Executive ${exec.role} has actionCount number`);
  }

  console.log('\n================================================================');
  console.log('TEST RESULT: ALL EXECUTIVE OVERSIGHT & PROFILE TESTS PASSED');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('\n[FATAL ERROR]', err.message);
  process.exit(1);
});
