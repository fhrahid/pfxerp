import assert from 'node:assert';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001/api/v1';

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

let passedCount = 0;
let failedCount = 0;
const results = [];

function recordTest(category, name, passed, details = '') {
  if (passed) {
    passedCount++;
    console.log(`  [PASS] [${category}] ${name}`);
    results.push({ category, name, status: 'PASS', details });
  } else {
    failedCount++;
    console.error(`  [FAIL] [${category}] ${name}: ${details}`);
    results.push({ category, name, status: 'FAIL', details });
  }
}

async function run() {
  console.log('========================================================================');
  console.log('  INDEPENDENT SECURITY AUDIT VERIFICATION SUITE');
  console.log('========================================================================\n');

  // 1. Authenticate Test Users
  console.log('--- Step 0: User Setup & Authentication ---');
  const ceoRes = await req('POST', '/auth/login', { email: 'noor@seu.edu.bd', password: 'PointfexCeo2026!' });
  assert.strictEqual(ceoRes.status, 200, 'CEO login must succeed');
  const ceoToken = ceoRes.data.data.accessToken;
  const ceoUser = ceoRes.data.data.user;

  const ctoRes = await req('POST', '/auth/login', { email: 'cto@seu.edu.bd', password: 'Pointfex2026!' });
  const ctoToken = ctoRes.data.data.accessToken;
  const ctoUser = ctoRes.data.data.user;

  const pm1Res = await req('POST', '/auth/login', { email: 'pm1@seu.edu.bd', password: 'Pointfex2026!' });
  const pm1Token = pm1Res.data.data.accessToken;
  const pm1User = pm1Res.data.data.user;

  const pm2Res = await req('POST', '/auth/login', { email: 'pm2@seu.edu.bd', password: 'Pointfex2026!' });
  const pm2Token = pm2Res.data.data.accessToken;
  const pm2User = pm2Res.data.data.user;

  const dev1Res = await req('POST', '/auth/login', { email: 'dev1_1@seu.edu.bd', password: 'Pointfex2026!' });
  const dev1Token = dev1Res.data.data.accessToken;
  const dev1User = dev1Res.data.data.user;

  const dev2Res = await req('POST', '/auth/login', { email: 'dev2_2@seu.edu.bd', password: 'Pointfex2026!' });
  const dev2Token = dev2Res.data.data.accessToken;
  const dev2User = dev2Res.data.data.user;

  const squadsRes = await req('GET', '/squads', null, ceoToken);
  const squad1 = squadsRes.data.data.find(s => s.name === 'Squad 1') || squadsRes.data.data[0];
  const squad2 = squadsRes.data.data.find(s => s.name === 'Squad 2') || squadsRes.data.data[1];

  console.log(`Authenticated: CEO (${ceoUser.id}), CTO (${ctoUser.id}), PM1 (${pm1User.id}), PM2 (${pm2User.id}), Dev1 (${dev1User.id}), Dev2 (${dev2User.id})`);
  console.log(`Squads: Squad1 (${squad1.id}), Squad2 (${squad2.id})\n`);

  // ========================================================================
  // AREA 1: Chaos Resolution Authorization Leak
  // ========================================================================
  console.log('--- AREA 1: Chaos Resolution Authorization Leak ---');

  // 1.1 Studio-wide chaos event (targetSquadId: null)
  const studioChaos = await req('POST', '/chaos/events', {
    type: 'SERVER_OUTAGE',
    title: 'Global Studio Incident Audit Test',
    description: 'Studio-wide outage to test isolation boundaries.',
    timeLimitSeconds: 120,
  }, ceoToken);
  assert.strictEqual(studioChaos.status, 201, 'Failed to trigger studio chaos');
  const studioChaosId = studioChaos.data.data.id;

  // 1.1a Dev cannot resolve studio chaos
  const devResolveStudio = await req('POST', `/chaos/events/${studioChaosId}/resolve`, { resolution: 'Dev exploit resolve' }, dev1Token);
  recordTest('Chaos Auth', 'Dev blocked from resolving studio-wide chaos (403 Forbidden)', devResolveStudio.status === 403, `Status: ${devResolveStudio.status}`);

  // 1.1b PM cannot resolve studio chaos
  const pm1ResolveStudio = await req('POST', `/chaos/events/${studioChaosId}/resolve`, { resolution: 'PM1 unauthorized studio resolve' }, pm1Token);
  recordTest('Chaos Auth', 'PM blocked from resolving studio-wide chaos (403 Forbidden)', pm1ResolveStudio.status === 403, `Status: ${pm1ResolveStudio.status}`);

  // 1.1c CEO can resolve studio chaos
  const ceoResolveStudio = await req('POST', `/chaos/events/${studioChaosId}/resolve`, { resolution: 'CEO legitimately resolves studio crisis' }, ceoToken);
  recordTest('Chaos Auth', 'CEO can resolve studio-wide chaos (200/201 Success)', ceoResolveStudio.status === 200 || ceoResolveStudio.status === 201, `Status: ${ceoResolveStudio.status}`);

  // 1.1d Already resolved event cannot be resolved again
  const reResolveStudio = await req('POST', `/chaos/events/${studioChaosId}/resolve`, { resolution: 'CEO resolve again' }, ceoToken);
  recordTest('Chaos Auth', 'Already resolved chaos cannot be resolved again (400 Bad Request)', reResolveStudio.status === 400, `Status: ${reResolveStudio.status}`);

  // 1.2 Squad-specific chaos incident (targetSquadId: Squad 1)
  const squadChaos = await req('POST', '/chaos/events', {
    type: 'SCOPE_CREEP',
    title: 'Squad 1 Scope Creep Test',
    description: 'Squad 1 specific scope creep event.',
    targetSquadId: squad1.id,
    timeLimitSeconds: 120,
  }, ceoToken);
  assert.strictEqual(squadChaos.status, 201, 'Failed to trigger squad chaos');
  const squadChaosId = squadChaos.data.data.id;

  // 1.2a Developer in Squad 1 cannot resolve squad chaos
  const dev1ResolveSquad = await req('POST', `/chaos/events/${squadChaosId}/resolve`, { resolution: 'Dev1 resolving squad incident' }, dev1Token);
  recordTest('Chaos Auth', 'Developer in target squad blocked from resolving chaos (403 Forbidden)', dev1ResolveSquad.status === 403, `Status: ${dev1ResolveSquad.status}`);

  // 1.2b Cross-squad PM (PM2) cannot resolve Squad 1 chaos
  const pm2ResolveSquad1 = await req('POST', `/chaos/events/${squadChaosId}/resolve`, { resolution: 'PM2 cross-squad resolve attack' }, pm2Token);
  recordTest('Chaos Auth', 'Cross-squad PM2 blocked from resolving Squad 1 chaos (403 Forbidden)', pm2ResolveSquad1.status === 403, `Status: ${pm2ResolveSquad1.status}`);

  // 1.2c Authorized target squad PM (PM1) can resolve Squad 1 chaos
  const pm1ResolveSquad1 = await req('POST', `/chaos/events/${squadChaosId}/resolve`, { resolution: 'PM1 legitimately resolves Squad 1 scope creep' }, pm1Token);
  recordTest('Chaos Auth', 'Target squad PM1 can resolve squad chaos (200/201 Success)', pm1ResolveSquad1.status === 200 || pm1ResolveSquad1.status === 201, `Status: ${pm1ResolveSquad1.status}`);

  // 1.3 CEO can resolve another squad-specific chaos incident
  const squad2Chaos = await req('POST', '/chaos/events', {
    type: 'SCOPE_CREEP',
    title: 'Squad 2 Scope Creep Test for CEO Resolution',
    description: 'Squad 2 specific event to test CEO override.',
    targetSquadId: squad2.id,
    timeLimitSeconds: 120,
  }, ceoToken);
  assert.strictEqual(squad2Chaos.status, 201, 'Failed to trigger squad 2 chaos');
  const squad2ChaosId = squad2Chaos.data.data.id;

  const ceoResolveSquad2 = await req('POST', `/chaos/events/${squad2ChaosId}/resolve`, { resolution: 'CEO executive override resolution for Squad 2' }, ceoToken);
  recordTest('Chaos Auth', 'CEO can resolve squad-specific chaos (executive override) (200/201 Success)', ceoResolveSquad2.status === 200 || ceoResolveSquad2.status === 201, `Status: ${ceoResolveSquad2.status}`);

  // ========================================================================
  // AREA 2: Git Proof Validation
  // ========================================================================
  console.log('\n--- AREA 2: Git Proof Validation on Tasks ---');

  // Create an in-progress task for dev1
  const t1 = await req('POST', '/tasks', {
    squadId: squad1.id,
    title: 'Task for Git Proof Audit Verification',
    description: 'Boundary testing of flag-complete proof requirements',
    assignedToId: dev1User.id,
    storyPoints: 2,
    priority: 'HIGH',
  }, pm1Token);
  assert.strictEqual(t1.status, 201, 'Task creation failed');
  const taskId = t1.data.data.id;

  // dev1 starts work
  const startRes = await req('POST', `/tasks/${taskId}/start`, {}, dev1Token);
  assert(startRes.status === 200 || startRes.status === 201, `Dev failed to start task: ${JSON.stringify(startRes.data)}`);

  // 2.1 Rejection of Empty Object {}
  const emptyRes = await req('POST', `/tasks/${taskId}/flag-complete`, {}, dev1Token);
  recordTest('Git Proof', 'Rejects empty proof body (400 TASK_MISSING_GIT_LINK)', emptyRes.status === 400 && /TASK_MISSING_GIT_LINK/.test(emptyRes.data?.error?.message), `Status: ${emptyRes.status}`);

  // 2.2 Rejection of whitespace-only strings
  const wsRes = await req('POST', `/tasks/${taskId}/flag-complete`, { gitPrUrl: '   ', gitCommitHash: '   ' }, dev1Token);
  recordTest('Git Proof', 'Rejects whitespace git proof strings (400 TASK_MISSING_GIT_LINK)', wsRes.status === 400 && /TASK_MISSING_GIT_LINK/.test(wsRes.data?.error?.message), `Status: ${wsRes.status}`);

  // 2.3 Rejection of non-hex commit hashes
  const nonHexRes = await req('POST', `/tasks/${taskId}/flag-complete`, { gitCommitHash: 'zzzz1234567890abcdef' }, dev1Token);
  recordTest('Git Proof', 'Rejects non-hex commit hash chars (400 TASK_INVALID_GIT_HASH)', nonHexRes.status === 400 && /TASK_INVALID_GIT_HASH/.test(nonHexRes.data?.error?.message), `Status: ${nonHexRes.status}`);

  // 2.4 Rejection of short commit hash (<7 chars)
  const shortHashRes = await req('POST', `/tasks/${taskId}/flag-complete`, { gitCommitHash: 'abcdef' }, dev1Token);
  recordTest('Git Proof', 'Rejects short commit hash <7 chars (400 TASK_INVALID_GIT_HASH)', shortHashRes.status === 400 && /TASK_INVALID_GIT_HASH/.test(shortHashRes.data?.error?.message), `Status: ${shortHashRes.status}`);

  // 2.5 Rejection of long commit hash (>40 chars)
  const longHashRes = await req('POST', `/tasks/${taskId}/flag-complete`, { gitCommitHash: 'a'.repeat(41) }, dev1Token);
  recordTest('Git Proof', 'Rejects long commit hash >40 chars (400 TASK_INVALID_GIT_HASH)', longHashRes.status === 400 && /TASK_INVALID_GIT_HASH/.test(longHashRes.data?.error?.message), `Status: ${longHashRes.status}`);

  // 2.6 Rejection of invalid non-HTTP/HTTPS URLs
  const ftpRes = await req('POST', `/tasks/${taskId}/flag-complete`, { gitPrUrl: 'ftp://github.com/pointfex/squad-1/pull/1' }, dev1Token);
  recordTest('Git Proof', 'Rejects non-HTTP(S) PR URL like ftp:// (400 TASK_INVALID_GIT_URL)', ftpRes.status === 400 && /TASK_INVALID_GIT_URL/.test(ftpRes.data?.error?.message), `Status: ${ftpRes.status}`);

  const jsUrlRes = await req('POST', `/tasks/${taskId}/flag-complete`, { gitPrUrl: 'javascript:alert(1)' }, dev1Token);
  recordTest('Git Proof', 'Rejects javascript: URI scheme (400 TASK_INVALID_GIT_URL)', jsUrlRes.status === 400 && /TASK_INVALID_GIT_URL/.test(jsUrlRes.data?.error?.message), `Status: ${jsUrlRes.status}`);

  // 2.7 Cross-actor flag complete attempt: Dev2 cannot flag dev1\'s task
  const dev2FlagDev1 = await req('POST', `/tasks/${taskId}/flag-complete`, {
    gitPrUrl: 'https://github.com/pointfex/squad-1/pull/99',
  }, dev2Token);
  recordTest('Git Proof', 'Unassigned developer blocked from flagging complete (403 Forbidden)', dev2FlagDev1.status === 403, `Status: ${dev2FlagDev1.status}`);

  // 2.8 Acceptance of valid PR URL and 40-char SHA1 commit hash
  const validFlag = await req('POST', `/tasks/${taskId}/flag-complete`, {
    gitPrUrl: 'https://github.com/pointfex/squad-1/pull/42',
    gitCommitHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4',
  }, dev1Token);
  recordTest('Git Proof', 'Accepts valid HTTP(S) PR URL and 40-char SHA1 hash (200/201 Success)', validFlag.status === 200 || validFlag.status === 201, `Status: ${validFlag.status}`);

  // ========================================================================
  // AREA 3: Member Profile, Task History & Missed Deadline Tracking
  // ========================================================================
  console.log('\n--- AREA 3: Member Profile, Task History & Missed Deadline Tracking ---');

  // Create an overdue task for dev1
  const overdueTaskRes = await req('POST', '/tasks', {
    squadId: squad1.id,
    title: 'Audit Overdue Verification Task',
    description: 'Explicitly overdue task to test deadline tracking',
    assignedToId: dev1User.id,
    storyPoints: 3,
    priority: 'CRITICAL',
    dueDate: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago
  }, pm1Token);
  assert.strictEqual(overdueTaskRes.status, 201, 'Failed to create overdue task');
  const overdueTaskId = overdueTaskRes.data.data.id;

  // 3.1 CEO fetches enriched member profile
  const profileRes = await req('GET', `/users/${dev1User.id}`, null, ceoToken);
  recordTest('Profile Audit', 'CEO can fetch full enriched member profile (200 OK)', profileRes.status === 200, `Status: ${profileRes.status}`);
  const profile = profileRes.data.data;

  // 3.2 Verify enriched structure fields
  const hasExpectedFields = Boolean(
    profile.stats &&
    Array.isArray(profile.assignedTasks) &&
    Array.isArray(profile.createdTasks) &&
    Array.isArray(profile.missedDeadlineTasks) &&
    Array.isArray(profile.dpiSnapshots) &&
    Array.isArray(profile.pmhiSnapshots)
  );
  recordTest('Profile Audit', 'Profile contains stats, assignedTasks, createdTasks, missedDeadlineTasks, dpiSnapshots, pmhiSnapshots', hasExpectedFields, `Keys: ${Object.keys(profile || {})}`);

  // 3.3 Verify overdue task detection and calculation
  const capturedOverdue = (profile.missedDeadlineTasks || []).find(t => t.id === overdueTaskId);
  const overdueCorrect = Boolean(
    capturedOverdue &&
    capturedOverdue.isCurrentlyOverdue === true &&
    capturedOverdue.daysOverdue >= 3
  );
  recordTest('Profile Audit', 'Overdue task correctly captured in missedDeadlineTasks with isCurrentlyOverdue=true and daysOverdue >= 3', overdueCorrect, `Captured: ${JSON.stringify(capturedOverdue)}`);

  // 3.4 Vertical Authorization Isolation: Developer cannot access another member\'s profile
  const devAccessDev2 = await req('GET', `/users/${dev2User.id}`, null, dev1Token);
  recordTest('Profile Auth', 'Developer blocked from viewing another developer profile (403 Forbidden)', devAccessDev2.status === 403, `Status: ${devAccessDev2.status}`);

  const devAccessCeo = await req('GET', `/users/${ceoUser.id}`, null, dev1Token);
  recordTest('Profile Auth', 'Developer blocked from viewing CEO profile (403 Forbidden)', devAccessCeo.status === 403, `Status: ${devAccessCeo.status}`);

  // 3.5 Developer can access their own profile
  const devOwnProfile = await req('GET', `/users/${dev1User.id}`, null, dev1Token);
  recordTest('Profile Auth', 'Developer can access own profile (200 OK)', devOwnProfile.status === 200, `Status: ${devOwnProfile.status}`);

  // 3.6 Other executive roles (CTO) can access any member profile
  const ctoAccessDev1 = await req('GET', `/users/${dev1User.id}`, null, ctoToken);
  recordTest('Profile Auth', 'Executive (CTO) can access any member profile (200 OK)', ctoAccessDev1.status === 200, `Status: ${ctoAccessDev1.status}`);

  // ========================================================================
  // AREA 4: Audit Logging & Executive Audit UI
  // ========================================================================
  console.log('\n--- AREA 4: Audit Logging & Executive Audit UI ---');

  // 4.1 Regular developer blocked from GET /audit/logs
  const devAuditLogs = await req('GET', '/audit/logs', null, dev1Token);
  recordTest('Audit Log Auth', 'Developer blocked from accessing executive audit logs (403 Forbidden)', devAuditLogs.status === 403, `Status: ${devAuditLogs.status}`);

  // 4.2 PM blocked from GET /audit/logs
  const pmAuditLogs = await req('GET', '/audit/logs', null, pm1Token);
  recordTest('Audit Log Auth', 'PM blocked from accessing executive audit logs (403 Forbidden)', pmAuditLogs.status === 403, `Status: ${pmAuditLogs.status}`);

  // 4.3 CEO queries executive audit logs
  const ceoAuditLogs = await req('GET', '/audit/logs?limit=50', null, ceoToken);
  recordTest('Audit Log Auth', 'CEO can access executive audit logs (200 OK)', ceoAuditLogs.status === 200, `Status: ${ceoAuditLogs.status}`);
  const auditData = ceoAuditLogs.data.data;

  // 4.4 Pagination metadata present
  const hasMeta = Boolean(auditData.meta && typeof auditData.meta.total === 'number' && typeof auditData.meta.page === 'number');
  recordTest('Audit Log Format', 'Audit logs response includes pagination metadata (meta.total, meta.page, etc.)', hasMeta, `Meta: ${JSON.stringify(auditData.meta)}`);

  // 4.5 Verify USER_LOGIN is logged
  const hasUserLogin = (auditData.data || []).some(log => log.actionType === 'USER_LOGIN');
  recordTest('Audit Log Event', 'USER_LOGIN event recorded in ExecutiveAuditLog', hasUserLogin, `Found: ${hasUserLogin}`);

  // 4.6 Trigger a profile update to test USER_PROFILE_UPDATED logging
  const updateRes = await req('PATCH', `/users/${dev1User.id}`, { fullName: 'Dev1 Updated For Audit' }, ceoToken);
  assert.strictEqual(updateRes.status, 200, 'Profile update failed');

  // Query audit logs filtered by USER_PROFILE_UPDATED
  const filterActionRes = await req('GET', '/audit/logs?actionType=USER_PROFILE_UPDATED&limit=10', null, ceoToken);
  const profileUpdatedLogs = filterActionRes.data.data?.data || [];
  const foundProfileUpdated = profileUpdatedLogs.some(log => log.actionType === 'USER_PROFILE_UPDATED' && log.payloadSnapshot?.targetUserId === dev1User.id);
  recordTest('Audit Log Event', 'USER_PROFILE_UPDATED event recorded in ExecutiveAuditLog upon member update', foundProfileUpdated, `Found: ${foundProfileUpdated}`);

  // 4.7 Query audit logs filtered by severity
  const filterSeverityRes = await req('GET', '/audit/logs?severity=INFO&limit=5', null, ceoToken);
  const severityLogs = filterSeverityRes.data.data?.data || [];
  const allInfo = severityLogs.length > 0 && severityLogs.every(l => l.riskSeverity === 'INFO');
  recordTest('Audit Log Filter', 'Audit log filtering by severity=INFO functions accurately', allInfo, `Count: ${severityLogs.length}`);

  // Restore dev1 full name
  await req('PATCH', `/users/${dev1User.id}`, { fullName: 'Dev 1-1' }, ceoToken);

  console.log('\n========================================================================');
  console.log(`  VERIFICATION RESULTS: ${passedCount} passed, ${failedCount} failed (${passedCount + failedCount} total)`);
  console.log('========================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
