import assert from 'node:assert';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001/api/v1';

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

let passed = 0;
let total = 0;

function pass(name) {
  passed++;
  console.log(`  [PASS] ${name}`);
}

function fail(name, err) {
  console.error(`  [FAIL] ${name}: ${err}`);
  throw new Error(`Test failed: ${name}`);
}

async function run() {
  console.log('========================================================================');
  console.log('  RUNNING VERIFICATION SUITE FOR AUDIT GAPS & FIXES');
  console.log('========================================================================\n');

  // 1. Authenticate Actors
  console.log('1. Authenticating test users...');
  const ceoRes = await req('POST', '/auth/login', { email: 'noor@seu.edu.bd', password: 'PointfexCeo2026!' });
  assert.strictEqual(ceoRes.status, 200, 'CEO login failed');
  const ceoToken = ceoRes.data.data.accessToken;
  const ceoUser = ceoRes.data.data.user;

  // Login a dev
  const devRes = await req('POST', '/auth/login', { email: 'dev1_1@seu.edu.bd', password: 'Pointfex2026!' });
  assert.strictEqual(devRes.status, 200, 'Dev1_1 login failed');
  const devToken = devRes.data.data.accessToken;
  const devUser = devRes.data.data.user;

  // Login a PM
  const pmRes = await req('POST', '/auth/login', { email: 'pm1@seu.edu.bd', password: 'Pointfex2026!' });
  assert.strictEqual(pmRes.status, 200, 'PM1 login failed');
  const pmToken = pmRes.data.data.accessToken;
  const pmUser = pmRes.data.data.user;

  pass('Authentication verified for CEO, PM, and Developer');

  // ------------------------------------------------------------------------
  // TEST SUITE 1: Chaos resolution authorization leak
  // ------------------------------------------------------------------------
  console.log('\n2. Testing Chaos Resolution Authorization...');

  // CEO triggers a studio-wide chaos event (targetSquadId: null)
  const triggerRes = await req('POST', '/chaos/events', {
    type: 'SERVER_OUTAGE',
    title: 'Studio Cloud Outage Test',
    description: 'A global infrastructure incident affecting all squads.',
    timeLimitSeconds: 60,
  }, ceoToken);
  assert.strictEqual(triggerRes.status, 201, 'CEO failed to trigger studio-wide chaos event');
  const studioEventId = triggerRes.data.data.id;

  // Developer attempts to resolve studio-wide chaos event -> MUST BE 403
  const devResolveRes = await req('POST', `/chaos/events/${studioEventId}/resolve`, {
    resolution: 'Developer trying to close studio crisis',
  }, devToken);
  assert.strictEqual(devResolveRes.status, 403, `Dev should be 403 forbidden resolving studio chaos, got ${devResolveRes.status}`);
  pass('Developer blocked from resolving studio-wide chaos event (403 Forbidden)');

  // PM attempts to resolve studio-wide chaos event -> MUST BE 403
  const pmResolveRes = await req('POST', `/chaos/events/${studioEventId}/resolve`, {
    resolution: 'PM trying to close studio crisis without target squad',
  }, pmToken);
  assert.strictEqual(pmResolveRes.status, 403, `PM should be 403 forbidden resolving studio chaos, got ${pmResolveRes.status}`);
  pass('PM blocked from resolving studio-wide chaos event (403 Forbidden)');

  // CEO resolves studio-wide chaos event -> MUST SUCCEED (200 or 201)
  const ceoResolveRes = await req('POST', `/chaos/events/${studioEventId}/resolve`, {
    resolution: 'CEO verified servers failover and resolved crisis.',
  }, ceoToken);
  assert(ceoResolveRes.status === 200 || ceoResolveRes.status === 201, `CEO should resolve studio crisis, got ${ceoResolveRes.status}`);
  pass('CEO successfully resolved studio-wide chaos event');

  // ------------------------------------------------------------------------
  // TEST SUITE 2: Git Proof Validation on Flag Complete
  // ------------------------------------------------------------------------
  console.log('\n3. Testing Git Proof Validation on Tasks...');

  // Fetch squad 1 tasks or create one for dev
  const squadsRes = await req('GET', '/squads', null, ceoToken);
  const squad1 = squadsRes.data.data[0];

  const taskRes = await req('POST', '/tasks', {
    squadId: squad1.id,
    title: 'Audit Git Proof Verification Task',
    description: 'Task to verify git proof validation and deadline tracking',
    assignedToId: devUser.id,
    storyPoints: 3,
    priority: 'HIGH',
    dueDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday (Overdue!)
  }, ceoToken);
  assert.strictEqual(taskRes.status, 201, 'Failed to create test task');
  const taskId = taskRes.data.data.id;

  // Dev starts work
  const startRes = await req('POST', `/tasks/${taskId}/start`, {}, devToken);
  assert(startRes.status === 200 || startRes.status === 201, 'Dev failed to start task');

  // Test empty proof
  const emptyProofRes = await req('POST', `/tasks/${taskId}/flag-complete`, {}, devToken);
  assert.strictEqual(emptyProofRes.status, 400, 'Empty proof should return 400');
  assert.match(emptyProofRes.data.error.message, /TASK_MISSING_GIT_LINK/, 'Error should mention TASK_MISSING_GIT_LINK');
  pass('flag-complete with empty proof rejected (400 TASK_MISSING_GIT_LINK)');

  // Test whitespace proof
  const wsProofRes = await req('POST', `/tasks/${taskId}/flag-complete`, { gitPrUrl: '   ', gitCommitHash: '  ' }, devToken);
  assert.strictEqual(wsProofRes.status, 400, 'Whitespace proof should return 400');
  pass('flag-complete with whitespace proof rejected (400 TASK_MISSING_GIT_LINK)');

  // Test invalid commit hash format (not hex)
  const invalidHashRes = await req('POST', `/tasks/${taskId}/flag-complete`, { gitCommitHash: 'not-a-valid-hex-hash-12345' }, devToken);
  assert.strictEqual(invalidHashRes.status, 400, 'Invalid commit hash should return 400');
  assert.match(invalidHashRes.data.error.message, /TASK_INVALID_GIT_HASH/, 'Error should mention TASK_INVALID_GIT_HASH');
  pass('flag-complete with invalid commit hash rejected (400 TASK_INVALID_GIT_HASH)');

  // Test invalid PR URL format
  const invalidUrlRes = await req('POST', `/tasks/${taskId}/flag-complete`, { gitPrUrl: 'ftp://invaliddomain/pr/1' }, devToken);
  assert.strictEqual(invalidUrlRes.status, 400, 'Invalid PR URL should return 400');
  assert.match(invalidUrlRes.data.error.message, /TASK_INVALID_GIT_URL/, 'Error should mention TASK_INVALID_GIT_URL');
  pass('flag-complete with non-HTTP/HTTPS PR URL rejected (400 TASK_INVALID_GIT_URL)');

  // Test valid PR URL and valid 40-char SHA1 commit hash
  const validProofRes = await req('POST', `/tasks/${taskId}/flag-complete`, {
    gitPrUrl: 'https://github.com/pointfex/squad-1/pull/42',
    gitCommitHash: 'a1b2c3d4e5f67890123456789abcdef012345678',
  }, devToken);
  assert(validProofRes.status === 200 || validProofRes.status === 201, `Valid git proof should succeed, got ${validProofRes.status}`);
  pass('flag-complete with valid PR URL & commit hash accepted');

  // ------------------------------------------------------------------------
  // TEST SUITE 3: Member Profile & Missed Deadline Tracking
  // ------------------------------------------------------------------------
  console.log('\n4. Testing Member Profile & Missed Deadline Tracking...');

  // Fetch Dev's enriched profile as CEO
  const devProfileRes = await req('GET', `/users/${devUser.id}`, null, ceoToken);
  assert.strictEqual(devProfileRes.status, 200, 'CEO failed to get dev profile');
  const profileData = devProfileRes.data.data;

  assert(profileData.stats, 'Profile must include stats');
  assert(Array.isArray(profileData.assignedTasks), 'Profile must include assignedTasks');
  assert(Array.isArray(profileData.missedDeadlineTasks), 'Profile must include missedDeadlineTasks');

  // Since we created a task with dueDate = yesterday and it was in progress / flagged complete, it should be in missedDeadlineTasks!
  const foundMissed = profileData.missedDeadlineTasks.find((t) => t.id === taskId);
  assert(foundMissed, 'Overdue task must be listed in missedDeadlineTasks');
  assert.strictEqual(foundMissed.isCurrentlyOverdue, true, 'isCurrentlyOverdue should be true');
  assert(foundMissed.daysOverdue >= 1, 'daysOverdue should be >= 1');
  pass('Overdue task accurately captured in missedDeadlineTasks with daysOverdue');

  // Non-executive (dev) cannot access another user's profile
  const devAccessCeoRes = await req('GET', `/users/${ceoUser.id}`, null, devToken);
  assert.strictEqual(devAccessCeoRes.status, 403, 'Dev should not be allowed to access CEO profile');
  pass('Vertical isolation enforced: Developer cannot access another member profile (403 Forbidden)');

  // Developer can access own profile
  const devOwnProfileRes = await req('GET', `/users/${devUser.id}`, null, devToken);
  assert.strictEqual(devOwnProfileRes.status, 200, 'Dev should access own profile');
  pass('Developer successfully accesses own enriched profile');

  // ------------------------------------------------------------------------
  // TEST SUITE 4: Audit Logging & RBAC Access Control
  // ------------------------------------------------------------------------
  console.log('\n5. Testing Audit Logging & Access Control...');

  // Dev tries to query audit logs -> MUST BE 403
  const devAuditRes = await req('GET', '/audit/logs', null, devToken);
  assert.strictEqual(devAuditRes.status, 403, 'Developer should be blocked from GET /audit/logs');
  pass('Developer blocked from accessing executive audit logs (403 Forbidden)');

  // CEO queries audit logs -> MUST BE 200
  const ceoAuditRes = await req('GET', '/audit/logs?limit=10', null, ceoToken);
  assert.strictEqual(ceoAuditRes.status, 200, 'CEO should access /audit/logs');
  const auditData = ceoAuditRes.data.data;
  assert(Array.isArray(auditData.data), 'Audit logs must return data array');
  assert(auditData.meta, 'Audit logs must return pagination metadata');

  // Verify USER_LOGIN is logged
  const loginLog = auditData.data.find((l) => l.actionType === 'USER_LOGIN');
  assert(loginLog, 'USER_LOGIN action must be present in executive audit logs');
  pass('USER_LOGIN action verified in ExecutiveAuditLog');

  // Test profile update audit logging
  const updateRes = await req('PATCH', `/users/${devUser.id}`, { studentId: 'SEU-CSE-999' }, ceoToken);
  assert.strictEqual(updateRes.status, 200, 'Failed to update profile');

  const afterUpdateLogs = await req('GET', '/audit/logs?actionType=USER_PROFILE_UPDATED', null, ceoToken);
  assert.strictEqual(afterUpdateLogs.status, 200);
  const updateLog = afterUpdateLogs.data.data.data.find((l) => l.actionType === 'USER_PROFILE_UPDATED');
  assert(updateLog, 'USER_PROFILE_UPDATED must be logged in ExecutiveAuditLog');
  pass('USER_PROFILE_UPDATED action verified in ExecutiveAuditLog');

  console.log('\n========================================================================');
  console.log(`  ALL AUDIT FIX TESTS PASSED: ${passed} passed`);
  console.log('========================================================================');
}

run().catch((e) => {
  console.error('\nTest suite execution failed:', e);
  process.exit(1);
});
