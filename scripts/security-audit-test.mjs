import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../dist/src/modules/auth/auth.service.js';
import { isAllowedEmailDomain } from '../dist/src/common/types.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://pointfex_admin:pointfex_dev_password@localhost:5432/pointfex_db?schema=public',
    },
  },
});

const jwt = new JwtService({
  secret: process.env.JWT_SECRET || 'dev_jwt_secret_change_me',
});

const authService = new AuthService(prisma, jwt);

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

console.log('================================================================');
console.log('   POINTFEX ERP — AUTHENTICATION & SECURITY AUDIT TEST SUITE   ');
console.log('================================================================\n');

/* ---------------- 1. STRICT DOMAIN VALIDATION (NO SUBDOMAINS) ---------------- */
console.log('1. Testing Strict Domain Enforcement (seu.edu.bd only):');

runTest('Valid standard user email', () => {
  assert.strictEqual(isAllowedEmailDomain('student@seu.edu.bd'), true);
  assert.strictEqual(isAllowedEmailDomain('noor@seu.edu.bd'), true);
  assert.strictEqual(isAllowedEmailDomain('12345678@seu.edu.bd'), true);
  assert.strictEqual(isAllowedEmailDomain('first.last+tag@seu.edu.bd'), true);
});

runTest('Case insensitivity & leading/trailing whitespace', () => {
  assert.strictEqual(isAllowedEmailDomain('Noor@SEU.EDU.BD'), true);
  assert.strictEqual(isAllowedEmailDomain('   noor@seu.edu.bd   '), true);
  assert.strictEqual(isAllowedEmailDomain('\tnoor@seu.edu.bd\n'), true);
});

runTest('Subdomains strictly REJECTED (as requested: no subdomains)', () => {
  assert.strictEqual(isAllowedEmailDomain('student@cse.seu.edu.bd'), false);
  assert.strictEqual(isAllowedEmailDomain('faculty@dept.seu.edu.bd'), false);
  assert.strictEqual(isAllowedEmailDomain('admin@mail.seu.edu.bd'), false);
});

runTest('Demo domains REJECTED (ALLOW_DEMO_ACCOUNTS removed)', () => {
  assert.strictEqual(isAllowedEmailDomain('cfo@pointfex.dev'), false);
  assert.strictEqual(isAllowedEmailDomain('dev@pfx.dev'), false);
});

/* ---------------- 2. VULNERABILITY & BYPASS RESISTANCE ---------------- */
console.log('\n2. Testing Vulnerability & Attack Vectors:');

runTest('Domain Spoofing / Suffix Injection', () => {
  // Attacker owns evil.com and attempts to fake domain as prefix
  assert.strictEqual(isAllowedEmailDomain('noor@seu.edu.bd.evil.com'), false);
  assert.strictEqual(isAllowedEmailDomain('noor@seu.edu.bd@evil.com'), false);
  assert.strictEqual(isAllowedEmailDomain('noor@evilseu.edu.bd'), false);
  assert.strictEqual(isAllowedEmailDomain('noor@seu.edu.bd.net'), false);
});

runTest('Regex Dot Unescaped Check (seuXeduXbd)', () => {
  // If dot was unescaped in regex, 'seuXeduXbd' would match
  assert.strictEqual(isAllowedEmailDomain('noor@seuxeduxbd'), false);
  assert.strictEqual(isAllowedEmailDomain('noor@seu1edu1bd'), false);
  assert.strictEqual(isAllowedEmailDomain('noor@seu-edu-bd'), false);
});

runTest('Null Byte Injection (%00 / \\0)', () => {
  assert.strictEqual(isAllowedEmailDomain('noor@seu.edu.bd\0evil.com'), false);
  assert.strictEqual(isAllowedEmailDomain('noor\0@seu.edu.bd'), false);
});

runTest('ReDoS Catastrophic Backtracking Attack', () => {
  const start = Date.now();
  // 50,000 repeating characters to probe for polynomial/exponential backtracking
  const longPayload = 'a'.repeat(50000) + '@seu.edu.bd';
  assert.strictEqual(isAllowedEmailDomain(longPayload), true);
  const badPayload = 'a'.repeat(50000) + '@notseu.edu.bd';
  assert.strictEqual(isAllowedEmailDomain(badPayload), false);
  const elapsed = Date.now() - start;
  assert(elapsed < 100, `ReDoS check took ${elapsed}ms (must be < 100ms)`);
});

runTest('Homoglyph / Unicode Confusable Attack', () => {
  // Cyrillic 'е' (U+0435) instead of Latin 'e'
  const cyrillicE = 'noor@s\u0435u.edu.bd';
  assert.strictEqual(isAllowedEmailDomain(cyrillicE), false);
  // Full-width @ character
  const fullWidthAt = 'noor\uFF20seu.edu.bd';
  assert.strictEqual(isAllowedEmailDomain(fullWidthAt), false);
});

runTest('Malformed & Type Confusion Inputs', () => {
  assert.strictEqual(isAllowedEmailDomain(''), false);
  assert.strictEqual(isAllowedEmailDomain('   '), false);
  assert.strictEqual(isAllowedEmailDomain(null), false);
  assert.strictEqual(isAllowedEmailDomain(undefined), false);
  assert.strictEqual(isAllowedEmailDomain(12345), false);
  assert.strictEqual(isAllowedEmailDomain({}), false);
  assert.strictEqual(isAllowedEmailDomain([]), false);
  assert.strictEqual(isAllowedEmailDomain('@seu.edu.bd'), false);
  assert.strictEqual(isAllowedEmailDomain('user@'), false);
  assert.strictEqual(isAllowedEmailDomain('user@@seu.edu.bd'), false);
});

/* ---------------- 3. AUTH SERVICE INTEGRATION WITH DATABASE ---------------- */
console.log('\n3. Testing AuthService & Database Authentication:');

await runAsyncTest('Legitimate login: valid @seu.edu.bd + right credential', async () => {
  const res = await authService.login('noor@seu.edu.bd', 'PointfexCeo2026!');
  assert(res.accessToken, 'Must return accessToken');
  assert(res.refreshToken, 'Must return refreshToken');
  assert.strictEqual(res.user.email, 'noor@seu.edu.bd');
  assert.strictEqual(res.user.role, 'CEO');
});

await runAsyncTest('Case-insensitive email login: Noor@SEU.EDU.BD + right credential', async () => {
  const res = await authService.login('Noor@SEU.EDU.BD', 'PointfexCeo2026!');
  assert(res.accessToken, 'Must return accessToken');
  assert.strictEqual(res.user.email, 'noor@seu.edu.bd');
});

await runAsyncTest('Whitespace padded email: "  noor@seu.edu.bd  " + right credential', async () => {
  const res = await authService.login('  noor@seu.edu.bd  ', 'PointfexCeo2026!');
  assert(res.accessToken, 'Must return accessToken');
});

await runAsyncTest('Brute force / Credential stuffing: valid @seu.edu.bd + WRONG password', async () => {
  try {
    await authService.login('noor@seu.edu.bd', 'IncorrectPassword123!');
    assert.fail('Must reject incorrect password');
  } catch (err) {
    assert.strictEqual(err.code, 'AUTH_INVALID_CREDENTIALS');
    assert.strictEqual(err.getStatus(), 401);
  }
});

await runAsyncTest('User enumeration prevention: non-existent @seu.edu.bd email', async () => {
  try {
    await authService.login('ghostuser999@seu.edu.bd', 'AnyPassword123!');
    assert.fail('Must reject non-existent user');
  } catch (err) {
    // Must return the exact same generic error code (AUTH_INVALID_CREDENTIALS, 401)
    // so attackers cannot enumerate valid user emails by timing or message diff
    assert.strictEqual(err.code, 'AUTH_INVALID_CREDENTIALS');
    assert.strictEqual(err.getStatus(), 401);
  }
});

await runAsyncTest('SQL Injection in Email parameter', async () => {
  const sqliPayloads = [
    "' OR 1=1 --@seu.edu.bd",
    "noor@seu.edu.bd'; DROP TABLE \"User\";--",
    "admin' OR '1'='1",
    "noor' UNION SELECT * FROM \"User\" --@seu.edu.bd",
  ];
  for (const payload of sqliPayloads) {
    try {
      await authService.login(payload, 'PointfexCeo2026!');
      assert.fail(`Payload should have failed: ${payload}`);
    } catch (err) {
      assert.strictEqual(err.code, 'AUTH_INVALID_CREDENTIALS');
      assert.strictEqual(err.getStatus(), 401);
    }
  }
});

await runAsyncTest('SQL Injection in Password parameter', async () => {
  const sqliPasswords = [
    "' OR '1'='1",
    "PointfexCeo2026!' OR 1=1 --",
    "'; DROP TABLE \"User\"; --",
  ];
  for (const pw of sqliPasswords) {
    try {
      await authService.login('noor@seu.edu.bd', pw);
      assert.fail(`SQLi password should have failed: ${pw}`);
    } catch (err) {
      assert.strictEqual(err.code, 'AUTH_INVALID_CREDENTIALS');
      assert.strictEqual(err.getStatus(), 401);
    }
  }
});

await runAsyncTest('JWT Token Security & Tamper Verification', async () => {
  const session = await authService.login('noor@seu.edu.bd', 'PointfexCeo2026!');
  
  // 1. Verify access token payload
  const decoded = await jwt.verifyAsync(session.accessToken);
  assert.strictEqual(decoded.email, 'noor@seu.edu.bd');
  assert.strictEqual(decoded.typ, 'access');

  // 2. Tampered token signature check
  const tamperedToken = session.accessToken.slice(0, -6) + 'AAAAAA';
  try {
    await jwt.verifyAsync(tamperedToken);
    assert.fail('Tampered JWT should be rejected');
  } catch (err) {
    assert(err.message.includes('signature') || err.name === 'JsonWebTokenError');
  }

  // 3. Token refresh works with valid refresh token
  const refreshed = await authService.refresh(session.refreshToken);
  assert(refreshed.accessToken, 'Must issue new access token');
  assert(refreshed.refreshToken, 'Must rotate refresh token');

  // 4. Refresh token reuse detection (replay attack)
  // Re-using the OLD refresh token must trigger reuse detection and revoke sessions
  try {
    await authService.refresh(session.refreshToken);
    assert.fail('Replaying old refresh token must be detected and rejected');
  } catch (err) {
    assert.strictEqual(err.code, 'AUTH_TOKEN_REVOKED');
  }

  // 5. Logout revokes active session
  await authService.logout(decoded.sub);
  try {
    await authService.refresh(refreshed.refreshToken);
    assert.fail('Logged-out session must reject refresh');
  } catch (err) {
    assert.strictEqual(err.code, 'AUTH_TOKEN_REVOKED');
  }
});

/* ---------------- 4. USER PROVISIONING VALIDATION ---------------- */
console.log('\n4. Testing User Management Domain Enforcement:');

await runAsyncTest('UsersService prevents creating non-@seu.edu.bd accounts', async () => {
  const { UsersService } = await import('../dist/src/modules/users/users.service.js');
  const usersService = new UsersService(prisma);
  
  const badEmails = [
    'hacker@gmail.com',
    'admin@seu.edu.bd.evil.com',
    'student@cse.seu.edu.bd',
    'tester@pointfex.dev',
  ];

  for (const email of badEmails) {
    try {
      await usersService.createUser({
        email,
        fullName: 'Test User',
        password: 'Password123!',
        role: 'DEVELOPER',
      });
      assert.fail(`Creation must reject: ${email}`);
    } catch (err) {
      assert.strictEqual(err.code, 'VALIDATION_FAILED');
      assert.strictEqual(err.getStatus(), 400);
    }
  }
});

await prisma.$disconnect();

console.log('\n================================================================');
console.log(`AUDIT RESULT: ${passed} / ${total} tests passed (100% SUCCESS)`);
console.log('================================================================');

