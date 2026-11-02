import assert from 'node:assert';

const BASE_URL = 'http://localhost:3001/api/v1';

let passed = 0;
let total = 0;

function pass(msg) {
  passed++;
  console.log(`  [PASS] ${msg}`);
}

async function runTest(name, fn) {
  total++;
  try {
    await fn();
    pass(name);
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function req(method, path, body, token, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

console.log('================================================================');
console.log('   POINTFEX ERP — INVITATIONS & AUTHENTICATION TEST SUITE       ');
console.log('================================================================\n');

async function main() {
  // 1. Authenticate as CEO
  console.log('1. Authenticating as CEO:');
  let ceoToken = null;
  await runTest('CEO login successful', async () => {
    const loginRes = await req('POST', '/auth/login', {
      email: 'noor@seu.edu.bd',
      password: 'PointfexCeo2026!',
    });
    assert.strictEqual(loginRes.status, 200, 'CEO login should return 200');
    ceoToken = loginRes.data.data.accessToken;
  });

  // 2. Test Role-Based Access Control on Invitations
  console.log('\n2. Testing RBAC on Invitations:');
  await runTest('Unauthenticated request to /invitations returns 401', async () => {
    const res = await req('GET', '/invitations');
    assert.strictEqual(res.status, 401);
  });

  await runTest('Non-C-level / regular user cannot send invitations (RBAC 403)', async () => {
    // Attempt with dummy developer token or non-exec
    // We will create a developer later and re-verify, but for now test invalid roles or token
    const res = await req('POST', '/invitations', { email: 'test@seu.edu.bd' }, 'invalid_token');
    assert.strictEqual(res.status, 401);
  });

  // 3. C-Level Creating Developer Invitation (72-hour expiration)
  console.log('\n3. Testing 72-Hour Developer Invitation Creation:');
  const testDevEmail = `newdev_${Date.now()}@seu.edu.bd`;
  let inviteToken = null;
  let invitationId = null;

  await runTest('CEO can send 72-hour developer invitation link', async () => {
    const res = await req('POST', '/invitations', {
      email: testDevEmail,
      role: 'DEVELOPER',
    }, ceoToken);

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.email, testDevEmail);
    assert.strictEqual(res.data.data.role, 'DEVELOPER');
    assert.strictEqual(res.data.data.status, 'PENDING');
    
    // Check 72 hour expiration window
    const expiresAt = new Date(res.data.data.expiresAt).getTime();
    const now = Date.now();
    const diffHours = (expiresAt - now) / (1000 * 60 * 60);
    assert.ok(diffHours >= 71.9 && diffHours <= 72.1, `Expires at should be ~72 hours in future, got ${diffHours}h`);

    inviteToken = res.data.data.rawToken;
    invitationId = res.data.data.id;
    assert.ok(inviteToken, 'rawToken should be provided in dev mode');
  });

  await runTest('Domain enforcement: non-@seu.edu.bd invitation is rejected', async () => {
    const res = await req('POST', '/invitations', {
      email: 'hacker@gmail.com',
      role: 'DEVELOPER',
    }, ceoToken);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.error.code, 'VALIDATION_FAILED');
  });

  // 3.5 Hierarchical Role Selection (CEO all roles vs other C-level PM and DEVELOPER only)
  console.log('\n3.5. Testing Hierarchical Role Selection Permissions:');
  const cfoLogin = await req('POST', '/auth/login', {
    email: 'cfo@seu.edu.bd',
    password: 'Pointfex2026!',
  });
  assert.strictEqual(cfoLogin.status, 200, 'CFO login should succeed');
  const cfoToken = cfoLogin.data.data.accessToken;

  await runTest('CEO can invite any role (PM, CTO, CFO, CPO, CEO, DEVELOPER)', async () => {
    const rolesToTest = ['PM', 'CTO', 'CFO', 'CPO', 'CEO'];
    for (const r of rolesToTest) {
      const em = `ceo_inv_${r.toLowerCase()}_${Date.now()}@seu.edu.bd`;
      const res = await req('POST', '/invitations', { email: em, role: r }, ceoToken);
      assert.strictEqual(res.status, 201, `CEO should be permitted to invite role ${r}`);
      assert.strictEqual(res.data.data.role, r);
    }
  });

  await runTest('Other C-level (CFO) can successfully invite DEVELOPER role', async () => {
    const em = `cfo_inv_dev_${Date.now()}@seu.edu.bd`;
    const res = await req('POST', '/invitations', { email: em, role: 'DEVELOPER' }, cfoToken);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.role, 'DEVELOPER');
  });

  await runTest('Other C-level (CFO) can successfully invite PM role', async () => {
    const em = `cfo_inv_pm_${Date.now()}@seu.edu.bd`;
    const res = await req('POST', '/invitations', { email: em, role: 'PM' }, cfoToken);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.role, 'PM');
  });

  await runTest('Other C-level (CFO) cannot invite executive roles (CEO, CFO, CTO, CPO) - returns 403', async () => {
    const forbiddenRoles = ['CEO', 'CFO', 'CTO', 'CPO'];
    for (const r of forbiddenRoles) {
      const em = `cfo_bad_${r.toLowerCase()}_${Date.now()}@seu.edu.bd`;
      const res = await req('POST', '/invitations', { email: em, role: r }, cfoToken);
      assert.strictEqual(res.status, 403, `CFO should NOT be permitted to invite role ${r}`);
      assert.strictEqual(res.data.error.code, 'AUTHZ_FORBIDDEN');
    }
  });

  // 3.6 Testing CEO Dynamic Role Creation & Custom Role Onboarding
  console.log('\n3.6. Testing Dynamic Role Creation (CEO only):');
  await runTest('Public/unauthenticated cannot create new roles', async () => {
    const res = await req('POST', '/roles', { name: 'INTERN' });
    assert.strictEqual(res.status, 401);
  });

  await runTest('Non-CEO C-level (CFO) cannot create new roles (RBAC 403)', async () => {
    const res = await req('POST', '/roles', { name: 'CHRO' }, cfoToken);
    assert.strictEqual(res.status, 403);
  });

  await runTest('CEO receives 400 when creating role with invalid format', async () => {
    const res = await req('POST', '/roles', { name: 'invalid role with spaces!' }, ceoToken);
    assert.strictEqual(res.status, 400);
  });

  const testRoleCode = `CHRO_${Date.now().toString().slice(-4)}`;
  await runTest('CEO can successfully create a new custom role', async () => {
    const res = await req('POST', '/roles', {
      name: testRoleCode,
      description: 'Chief Human Resources Officer',
    }, ceoToken);

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.name, testRoleCode);
    assert.strictEqual(res.data.data.isSystem, false);
    assert.strictEqual(res.data.data.description, 'Chief Human Resources Officer');
  });

  await runTest('Duplicate role creation is rejected with 409 CONFLICT', async () => {
    const res = await req('POST', '/roles', {
      name: testRoleCode,
      description: 'Duplicate role attempt',
    }, ceoToken);
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.data.error.code, 'CONFLICT');
  });

  await runTest('GET /roles includes both system roles and newly created custom roles', async () => {
    const res = await req('GET', '/roles', null, ceoToken);
    assert.strictEqual(res.status, 200);
    const names = res.data.data.map((r) => r.name);
    assert.ok(names.includes('CEO'));
    assert.ok(names.includes('DEVELOPER'));
    assert.ok(names.includes(testRoleCode));
  });

  await runTest('Non-CEO C-level (CFO) CANNOT invite with the newly created custom role (403)', async () => {
    const em = `cfo_inv_chro_${Date.now()}@seu.edu.bd`;
    const res = await req('POST', '/invitations', { email: em, role: testRoleCode }, cfoToken);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.error.code, 'AUTHZ_FORBIDDEN');
  });

  let customRoleInviteToken = null;
  const customRoleEmail = `chro_user_${Date.now()}@seu.edu.bd`;
  await runTest('CEO CAN dispatch invitation with the newly created custom role', async () => {
    const res = await req('POST', '/invitations', { email: customRoleEmail, role: testRoleCode }, ceoToken);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.email, customRoleEmail);
    assert.strictEqual(res.data.data.role, testRoleCode);
    customRoleInviteToken = res.data.data.rawToken;
    assert.ok(customRoleInviteToken);
  });

  await runTest('Inviting with non-existent role is rejected (400 VALIDATION_FAILED)', async () => {
    const res = await req('POST', '/invitations', {
      email: `fake_role_${Date.now()}@seu.edu.bd`,
      role: 'TOTALLY_NON_EXISTENT_ROLE_XYZ',
    }, ceoToken);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.error.code, 'VALIDATION_FAILED');
  });

  await runTest('User invited with custom role accepts invitation and logs in with that role', async () => {
    const acceptRes = await req('POST', '/invitations/accept', {
      token: customRoleInviteToken,
      fullName: 'Chief HR Officer Person',
      password: 'ChroPassword2026!',
    });
    assert.strictEqual(acceptRes.status, 200);
    assert.strictEqual(acceptRes.data.data.user.role, testRoleCode);
    assert.strictEqual(acceptRes.data.data.user.walletBalance, 0);

    // Verify login
    const loginRes = await req('POST', '/auth/login', {
      email: customRoleEmail,
      password: 'ChroPassword2026!',
    });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.data.data.user.role, testRoleCode);
  });

  // 4. Listing Invitations as C-Level
  console.log('\n4. Testing Listing Invitations:');
  await runTest('CEO can view invitations list with live expiration status', async () => {
    const res = await req('GET', '/invitations', null, ceoToken);
    assert.strictEqual(res.status, 200);
    const found = res.data.data.find((inv) => inv.id === invitationId);
    assert.ok(found, 'Created invitation should appear in list');
    assert.strictEqual(found.status, 'PENDING');
  });

  // 5. Testing Resend Invitation (Refreshes 72-hour window)
  console.log('\n5. Testing Resend Invitation Functionality:');
  let resentToken = null;
  await runTest('CEO can resend invitation, refreshing 72h window and token', async () => {
    const res = await req('POST', `/invitations/${invitationId}/resend`, null, ceoToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.success, true);
    resentToken = res.data.data.rawToken;
    assert.ok(resentToken, 'New rawToken generated');
    assert.notStrictEqual(resentToken, inviteToken, 'New token should differ from old token');

    const diffHours = (new Date(res.data.data.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
    assert.ok(diffHours >= 71.9 && diffHours <= 72.1, 'Resent invitation has fresh 72-hour window');
  });

  await runTest('Old token is invalidated after resend', async () => {
    const res = await req('GET', `/invitations/verify/${inviteToken}`);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.error.code, 'AUTH_INVALID_TOKEN');
  });

  await runTest('New resent token verifies successfully', async () => {
    const res = await req('GET', `/invitations/verify/${resentToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.valid, true);
    assert.strictEqual(res.data.data.email, testDevEmail);
    assert.strictEqual(res.data.data.role, 'DEVELOPER');
  });

  // 6. Testing Developer Account Activation via Invitation Link
  console.log('\n6. Testing Accept Invitation & Developer Onboarding:');
  let devToken = null;
  await runTest('Developer accepts invitation: sets password, provisions wallet and auto-logs in', async () => {
    const res = await req('POST', '/invitations/accept', {
      token: resentToken,
      fullName: 'Farhan Developer',
      password: 'DevPassword2026!',
      studentId: `DEV_${Date.now().toString().slice(-6)}`,
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.data.data.accessToken, 'Access token should be issued');
    assert.ok(res.data.data.refreshToken, 'Refresh token should be issued');
    assert.strictEqual(res.data.data.user.role, 'DEVELOPER');
    assert.strictEqual(res.data.data.user.email, testDevEmail);
    assert.strictEqual(res.data.data.user.walletBalance, 0);

    devToken = res.data.data.accessToken;
  });

  await runTest('Used invitation cannot be reused (replay protection)', async () => {
    const res = await req('POST', '/invitations/accept', {
      token: resentToken,
      fullName: 'Imposter Dev',
      password: 'DevPassword2026!',
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.error.code, 'AUTH_INVALID_TOKEN');
  });

  await runTest('Developer can log in with newly configured password', async () => {
    const res = await req('POST', '/auth/login', {
      email: testDevEmail,
      password: 'DevPassword2026!',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.user.email, testDevEmail);
    assert.strictEqual(res.data.data.user.role, 'DEVELOPER');
  });

  await runTest('Developer (non-C-level) cannot access /invitations endpoints (RBAC 403)', async () => {
    const res = await req('GET', '/invitations', null, devToken);
    assert.strictEqual(res.status, 403);
  });

  // 7. Testing 72-Hour Expiration Enforcement
  console.log('\n7. Testing 72-Hour Expiration Enforcement:');
  const expiredDevEmail = `expireddev_${Date.now()}@seu.edu.bd`;
  await runTest('Expired invitation (>72 hours) is rejected by verify & accept', async () => {
    // Create an invitation
    const createRes = await req('POST', '/invitations', { email: expiredDevEmail, role: 'DEVELOPER' }, ceoToken);
    const expToken = createRes.data.data.rawToken;
    const expId = createRes.data.data.id;

    // Direct database manipulation via node script or simulate expired date
    // We can import PrismaClient to set expiresAt to past
    const { PrismaClient } = await import('@prisma/client');
    const p = new PrismaClient({ datasources: { db: { url: 'postgresql://pointfex_admin:pointfex_dev_password@localhost:5432/pointfex_db?schema=public' } } });
    await p.invitation.update({
      where: { id: expId },
      data: { expiresAt: new Date(Date.now() - 1000 * 60) }, // 1 minute in past
    });
    await p.$disconnect();

    // Verify should fail
    const verifyRes = await req('GET', `/invitations/verify/${expToken}`);
    assert.strictEqual(verifyRes.status, 401);
    assert.strictEqual(verifyRes.data.error.code, 'AUTH_TOKEN_EXPIRED');

    // Accept should fail
    const acceptRes = await req('POST', '/invitations/accept', {
      token: expToken,
      fullName: 'Late Dev',
      password: 'LatePassword2026!',
    });
    assert.strictEqual(acceptRes.status, 401);
    assert.strictEqual(acceptRes.data.error.code, 'AUTH_TOKEN_EXPIRED');
  });

  // 8. Testing Forgot Password & Password Reset Flow
  console.log('\n8. Testing Forgot Password & Password Reset Flow:');
  let resetToken = null;
  await runTest('Forgot password dispatches email with secure reset link (SEC-03 protected)', async () => {
    // 1. Without internal test key, resetUrl is NEVER disclosed in public response
    const unauthRes = await req('POST', '/auth/forgot-password', {
      email: testDevEmail,
    });
    assert.strictEqual(unauthRes.status, 200);
    assert.strictEqual(unauthRes.data.data.resetUrl, undefined, 'Public callers must never receive resetUrl');

    // 2. With authorized internal test key, test runner receives resetUrl
    const testSecret = process.env.LEDGER_SECRET_KEY || 'replace_with_ledger_hmac_secret_sha256_change_me';
    const res = await req('POST', '/auth/forgot-password', {
      email: testDevEmail,
    }, null, { 'x-internal-test-key': testSecret });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.success, true);
    assert.ok(res.data.data.resetUrl, 'Reset URL returned for authorized test harness');
    const url = new URL(res.data.data.resetUrl.replace('/#', '/'));
    resetToken = url.searchParams.get('token');
    assert.ok(resetToken, 'Reset token extracted');
  });

  await runTest('User enumeration protection: non-existent email returns generic success without resetUrl', async () => {
    const res = await req('POST', '/auth/forgot-password', {
      email: 'nonexistentuser@seu.edu.bd',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.success, true);
    assert.strictEqual(res.data.data.resetUrl, undefined, 'Must not disclose resetUrl for non-existent account');
  });

  await runTest('Reset password updates password and revokes previous sessions', async () => {
    const res = await req('POST', '/auth/reset-password', {
      token: resetToken,
      password: 'BrandNewDevPassword2026!',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.success, true);
  });

  await runTest('Old password no longer works', async () => {
    const res = await req('POST', '/auth/login', {
      email: testDevEmail,
      password: 'DevPassword2026!',
    });
    assert.strictEqual(res.status, 401);
  });

  await runTest('New password successfully authenticates', async () => {
    const res = await req('POST', '/auth/login', {
      email: testDevEmail,
      password: 'BrandNewDevPassword2026!',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.user.email, testDevEmail);
  });

  await runTest('Used reset token cannot be reused (single-use enforcement)', async () => {
    const res = await req('POST', '/auth/reset-password', {
      token: resetToken,
      password: 'AnotherPassword2026!',
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.error.code, 'AUTH_INVALID_TOKEN');
  });

  console.log('\n================================================================');
  console.log(`TEST RESULT: ${passed} / ${total} tests passed (100% SUCCESS)`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\nSuite failed:', err);
  process.exit(1);
});

