import puppeteer from 'puppeteer-core';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const SCRATCH_DIR = '/home/naim/.gemini/antigravity/brain/8c95619f-2c04-4099-ac68-76e7159b225e/scratch';
const BASE_URL = 'http://localhost:3001';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runManualQATest() {
  console.log('================================================================');
  console.log('Starting Pointfex ERP Browser QA Automation & Verification Suite');
  console.log('Target: ' + BASE_URL);
  console.log('Scratch Directory: ' + SCRATCH_DIR);
  console.log('================================================================\n');

  fs.mkdirSync(SCRATCH_DIR, { recursive: true });

  // ---------------------------------------------------------------------------
  // Pre-test Cleanup
  // ---------------------------------------------------------------------------
  console.log('[Setup] Cleaning up test artifacts from previous runs...');
  const existingDev = await prisma.user.findUnique({ where: { email: 'manual_qa_dev@seu.edu.bd' } });
  if (existingDev) {
    await prisma.account.deleteMany({ where: { ownerId: existingDev.id } });
    await prisma.squadMembership.deleteMany({ where: { userId: existingDev.id } });
    await prisma.user.delete({ where: { id: existingDev.id } });
    console.log('  Cleaned up existing user: manual_qa_dev@seu.edu.bd');
  }
  const deletedInvites = await prisma.invitation.deleteMany({ where: { email: 'manual_qa_dev@seu.edu.bd' } });
  if (deletedInvites.count > 0) {
    console.log(`  Deleted ${deletedInvites.count} previous invitations for manual_qa_dev@seu.edu.bd`);
  }
  const deletedRole = await prisma.role.deleteMany({ where: { name: 'QA_DIRECTOR' } });
  if (deletedRole.count > 0) {
    console.log('  Deleted existing role: QA_DIRECTOR');
  }
  console.log('[Setup] Database is clean and ready.\n');

  // Launch Google Chrome via puppeteer-core
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,900',
    ],
    headless: 'new',
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();
  page.on('pageerror', (err) => console.error('[Page Error]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[Page Console Error]', msg.text());
  });

  // Track raw invitation tokens intercepted from API
  let capturedToken = null;
  let capturedInviteUrl = null;

  page.on('response', async (response) => {
    try {
      const url = response.url();
      if (url.includes('/api/v1/invitations') && response.request().method() === 'POST') {
        const json = await response.json();
        const data = json.data || json;
        if (data.rawToken) {
          capturedToken = data.rawToken;
          console.log('  [Network Intercept] Captured invitation rawToken:', capturedToken);
        }
        if (data.inviteUrl) {
          capturedInviteUrl = data.inviteUrl;
          console.log('  [Network Intercept] Captured inviteUrl:', capturedInviteUrl);
        }
      }
    } catch (_) {}
  });

  try {
    // =========================================================================
    // TEST 1: Forgot Password Flow from Login Screen
    // =========================================================================
    console.log('----------------------------------------------------------------');
    console.log('TEST 1: Forgot Password Flow from Login Screen');
    console.log('----------------------------------------------------------------');

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });

    await page.waitForSelector('#login-form', { timeout: 10000 });
    console.log('Step 1.1: Login screen loaded.');

    // Find and click "Forgot password?"
    const forgotLink = await page.evaluateHandle(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.find((a) => a.textContent.includes('Forgot password?'));
    });
    if (!forgotLink || !forgotLink.asElement()) {
      throw new Error('Forgot password? link not found on login screen!');
    }
    await forgotLink.asElement().click();
    await page.waitForSelector('#forgot-form', { timeout: 5000 });
    console.log('Step 1.2: Clicked "Forgot password?", form displayed.');

    // Screenshot of Forgot Password screen
    await page.screenshot({ path: path.join(SCRATCH_DIR, '01_forgot_password_screen.png') });
    console.log('  Screenshot: 01_forgot_password_screen.png');

    // Submit institutional email noor@seu.edu.bd
    console.log('Step 1.3: Submitting institutional email: noor@seu.edu.bd');
    await page.type('#forgot-form input[name="email"]', 'noor@seu.edu.bd');
    await page.click('#forgot-form button[type="submit"]');

    // Verify confirmation message / toast
    await page.waitForSelector('.toast.ok, .toast', { timeout: 8000 });
    await sleep(600);
    const confirmationMsg = await page.evaluate(() => {
      const el = document.querySelector('.toast.ok, .toast');
      return el ? el.textContent.trim() : '';
    });
    console.log(`Step 1.4: Confirmation received: "${confirmationMsg}"`);
    if (!confirmationMsg || (!confirmationMsg.includes('password reset link') && !confirmationMsg.includes('dispatched'))) {
      throw new Error(`Unexpected forgot password response: "${confirmationMsg}"`);
    }

    await page.screenshot({ path: path.join(SCRATCH_DIR, '02_forgot_password_submitted.png') });
    console.log('  Screenshot: 02_forgot_password_submitted.png');
    console.log('✓ TEST 1 PASSED: Forgot Password flow successfully verified.\n');

    // =========================================================================
    // TEST 2: CEO Login & Dynamic Role Creation
    // =========================================================================
    console.log('----------------------------------------------------------------');
    console.log('TEST 2: CEO Login & Dynamic Role Creation');
    console.log('----------------------------------------------------------------');

    // Return to sign in
    const backBtn = await page.waitForSelector('#forgot-form button.ghost', { timeout: 5000 });
    await backBtn.click();
    await page.waitForSelector('#login-form', { timeout: 5000 });

    // Fill CEO credentials
    console.log('Step 2.1: Logging in as CEO (noor@seu.edu.bd)...');
    await page.type('#login-form input[name="email"]', 'noor@seu.edu.bd');
    await page.type('#login-form input[name="password"]', 'PointfexCeo2026!');
    await page.screenshot({ path: path.join(SCRATCH_DIR, '03_ceo_login_screen.png') });
    console.log('  Screenshot: 03_ceo_login_screen.png');

    await page.click('#login-form button[type="submit"]');
    await page.waitForSelector('.sidebar .userbox', { timeout: 10000 });
    await sleep(600);

    const ceoName = await page.$eval('.sidebar .userbox .name', (el) => el.textContent.trim());
    const ceoRole = await page.$eval('.sidebar .userbox .role', (el) => el.textContent.trim());
    console.log(`Step 2.2: Authenticated as CEO: ${ceoName} [${ceoRole}]`);
    if (ceoRole !== 'CEO') throw new Error(`Expected role CEO, got: ${ceoRole}`);

    // Navigate to "Invitations" tab
    console.log('Step 2.3: Navigating to "Invitations" tab...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.sidebar a.nav-btn')).find((e) => e.textContent.trim() === 'Invitations');
      if (btn) btn.click();
    });

    await page.waitForFunction(() => {
      return document.querySelector('#tab-actions')?.textContent.includes('Invite');
    }, { timeout: 8000 });
    await sleep(500);

    await page.screenshot({ path: path.join(SCRATCH_DIR, '04_ceo_invitations_tab.png') });
    console.log('  Screenshot: 04_ceo_invitations_tab.png');

    // Click "+ New Role"
    console.log('Step 2.4: Clicking "+ New Role" button...');
    const newRoleBtnClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#tab-actions button')).find((e) => e.textContent.includes('New Role'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!newRoleBtnClicked) throw new Error('"+ New Role" button not found in tab-actions for CEO!');

    await page.waitForSelector('#modal-root #mform', { timeout: 5000 });
    const modalTitle = await page.$eval('#modal-root h3', (el) => el.textContent.trim());
    console.log(`Step 2.5: Modal opened: "${modalTitle}"`);

    // Create custom role QA_DIRECTOR with description "Director of Quality Assurance"
    console.log('Step 2.6: Filling role details: QA_DIRECTOR / Director of Quality Assurance...');
    await page.type('#modal-root #mform input[name="name"]', 'QA_DIRECTOR');
    await page.type('#modal-root #mform input[name="description"]', 'Director of Quality Assurance');
    await page.screenshot({ path: path.join(SCRATCH_DIR, '05_ceo_create_role_modal.png') });
    console.log('  Screenshot: 05_ceo_create_role_modal.png');

    // Submit modal
    await page.click('#modal-root #mform button[type="submit"]');

    // Confirm modal closes and role is created
    await page.waitForFunction(() => {
      return !document.querySelector('#modal-root #mform');
    }, { timeout: 6000 });
    console.log('Step 2.7: Modal closed successfully.');

    // Verify role in database and toast
    await sleep(600);
    const dbRole = await prisma.role.findUnique({ where: { name: 'QA_DIRECTOR' } });
    if (!dbRole) throw new Error('Role QA_DIRECTOR was not found in the database!');
    console.log(`Step 2.8: Verified role in database: ID=${dbRole.id}, Name=${dbRole.name}, Desc="${dbRole.description}"`);

    await page.screenshot({ path: path.join(SCRATCH_DIR, '06_ceo_role_created_toast.png') });
    console.log('  Screenshot: 06_ceo_role_created_toast.png');

    // Click "+ Invite Member (All Roles)"
    console.log('Step 2.9: Clicking "+ Invite Member (All Roles)"...');
    const inviteBtnClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#tab-actions button')).find((e) => e.textContent.includes('Invite Member'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!inviteBtnClicked) throw new Error('"+ Invite Member (All Roles)" button not found for CEO!');

    await page.waitForSelector('#modal-root #mform', { timeout: 5000 });

    // Inspect the role dropdown options
    const roleOptions = await page.$$eval('#modal-root #mform select[name="role"] option', (opts) =>
      opts.map((o) => ({ value: o.value, text: o.textContent.trim() }))
    );
    const roleValues = roleOptions.map((o) => o.value);
    console.log('Step 2.10: Inspecting Role Dropdown Options in CEO Invite Modal:');
    roleOptions.forEach((o) => console.log(`   - Value: ${o.value} | Label: "${o.text}"`));

    const requiredSystemRoles = ['CEO', 'CFO', 'CTO', 'CPO', 'PM', 'DEVELOPER'];
    for (const r of requiredSystemRoles) {
      if (!roleValues.includes(r)) {
        throw new Error(`System role "${r}" missing from CEO invitation dropdown!`);
      }
    }
    if (!roleValues.includes('QA_DIRECTOR')) {
      throw new Error('Newly created dynamic role "QA_DIRECTOR" missing from CEO invitation dropdown!');
    }
    console.log('✓ Confirmed: All system roles (CEO, CFO, CTO, CPO, PM, DEVELOPER) PLUS newly created role QA_DIRECTOR are selectable!');

    // Send invitation to manual_qa_dev@seu.edu.bd with role DEVELOPER
    console.log('Step 2.11: Sending invitation to manual_qa_dev@seu.edu.bd with role DEVELOPER...');
    await page.type('#modal-root #mform input[name="email"]', 'manual_qa_dev@seu.edu.bd');
    await page.select('#modal-root #mform select[name="role"]', 'DEVELOPER');
    await page.screenshot({ path: path.join(SCRATCH_DIR, '07_ceo_invite_modal_roles_dropdown.png') });
    console.log('  Screenshot: 07_ceo_invite_modal_roles_dropdown.png');

    await page.click('#modal-root #mform button[type="submit"]');

    // Wait for modal to close and list table to reload
    await page.waitForFunction(() => {
      return !document.querySelector('#modal-root #mform');
    }, { timeout: 6000 });
    await sleep(1000);

    // Verify invitation appears in the list table
    const tableHasDev = await page.evaluate(() => {
      return document.querySelector('#content')?.textContent.includes('manual_qa_dev@seu.edu.bd');
    });
    if (!tableHasDev) {
      throw new Error('Invitation for manual_qa_dev@seu.edu.bd not found in invitations table!');
    }
    console.log('Step 2.12: Invitation confirmed in list table.');
    await page.screenshot({ path: path.join(SCRATCH_DIR, '08_ceo_invite_sent_in_table.png') });
    console.log('  Screenshot: 08_ceo_invite_sent_in_table.png');

    // Click "Resend (72h)" and verify expiration window is refreshed and toast is displayed
    console.log('Step 2.13: Clicking "Resend (72h)" on invitation row...');
    const prevExpiresAt = (await prisma.invitation.findFirst({ where: { email: 'manual_qa_dev@seu.edu.bd' } }))?.expiresAt;

    const resendClicked = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#content table tr'));
      for (const row of rows) {
        if (row.textContent.includes('manual_qa_dev@seu.edu.bd')) {
          const btn = Array.from(row.querySelectorAll('button')).find((b) => b.textContent.includes('Resend'));
          if (btn) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    });
    if (!resendClicked) throw new Error('Resend (72h) button not found for manual_qa_dev@seu.edu.bd!');

    // Verify toast is displayed
    await page.waitForFunction(() => {
      const toasts = Array.from(document.querySelectorAll('#toast-root .toast'));
      return toasts.some((t) => t.textContent.includes('resent') || t.textContent.includes('Resent') || t.textContent.includes('72-hour'));
    }, { timeout: 8000 });
    await sleep(600);

    const toastMsg = await page.evaluate(() => {
      const toasts = Array.from(document.querySelectorAll('#toast-root .toast'));
      return toasts.map((t) => t.textContent.trim()).join(' | ');
    });
    console.log(`Step 2.14: Resend toast displayed: "${toastMsg}"`);

    // Verify expiration window refreshed in database
    const newExpiresAt = (await prisma.invitation.findFirst({ where: { email: 'manual_qa_dev@seu.edu.bd' } }))?.expiresAt;
    console.log(`Step 2.15: Expiration window checked: before=${prevExpiresAt?.toISOString()}, after=${newExpiresAt?.toISOString()}`);
    if (newExpiresAt.getTime() < prevExpiresAt.getTime()) {
      throw new Error('Expiration timestamp was not refreshed forward!');
    }

    await page.screenshot({ path: path.join(SCRATCH_DIR, '09_ceo_invitation_resent_toast.png') });
    console.log('  Screenshot: 09_ceo_invitation_resent_toast.png');
    console.log('✓ TEST 2 PASSED: CEO login, custom role QA_DIRECTOR creation, role dropdown verification, invitation dispatch, and 72h resend verified.\n');

    // Extract active token for onboarding
    if (!capturedToken && capturedInviteUrl) {
      const u = new URL(capturedInviteUrl.replace('/#', '/'));
      capturedToken = u.searchParams.get('token');
    }
    console.log(`Captured Invitation Token for Acceptance: ${capturedToken}`);
    if (!capturedToken) {
      throw new Error('Failed to capture active rawToken for manual_qa_dev@seu.edu.bd!');
    }

    // =========================================================================
    // TEST 3: Non-CEO (CFO) Login & Role Restriction Verification
    // =========================================================================
    console.log('----------------------------------------------------------------');
    console.log('TEST 3: Non-CEO (CFO) Login & Role Restriction Verification');
    console.log('----------------------------------------------------------------');

    // Open fresh page for CFO
    const cfoPage = await browser.newPage();
    cfoPage.on('pageerror', (err) => console.error('[CFO Page Error]', err.message));

    await cfoPage.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await cfoPage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await cfoPage.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await cfoPage.waitForSelector('#login-form', { timeout: 8000 });

    console.log('Step 3.1: Logging in as CFO (cfo@seu.edu.bd)...');
    await cfoPage.type('#login-form input[name="email"]', 'cfo@seu.edu.bd');
    await cfoPage.type('#login-form input[name="password"]', 'Pointfex2026!');
    await cfoPage.click('#login-form button[type="submit"]');

    await cfoPage.waitForSelector('.sidebar .userbox', { timeout: 8000 });
    await sleep(600);
    const cfoName = await cfoPage.$eval('.sidebar .userbox .name', (el) => el.textContent.trim());
    const cfoRole = await cfoPage.$eval('.sidebar .userbox .role', (el) => el.textContent.trim());
    console.log(`Step 3.2: Authenticated as: ${cfoName} [${cfoRole}]`);
    if (cfoRole !== 'CFO') throw new Error(`Expected role CFO, got: ${cfoRole}`);

    // Navigate to "Invitations" tab
    console.log('Step 3.3: Navigating to "Invitations" tab as CFO...');
    await cfoPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.sidebar a.nav-btn')).find((e) => e.textContent.trim() === 'Invitations');
      if (btn) btn.click();
    });

    await cfoPage.waitForFunction(() => {
      return document.querySelector('#tab-actions')?.textContent.includes('Invite Dev / PM');
    }, { timeout: 8000 });
    await sleep(500);

    // Verify button displays "+ Invite Dev / PM" (no "+ New Role" button for non-CEO)
    const tabActionButtons = await cfoPage.$$eval('#tab-actions button', (btns) => btns.map((b) => b.textContent.trim()));
    console.log('Step 3.4: CFO tab action buttons:', tabActionButtons.join(', '));

    const hasInviteDevPm = tabActionButtons.some((b) => b.includes('+ Invite Dev / PM'));
    const hasNewRole = tabActionButtons.some((b) => b.includes('New Role'));

    if (!hasInviteDevPm) {
      throw new Error(`Expected "+ Invite Dev / PM" button for CFO, but found: [${tabActionButtons.join(', ')}]`);
    }
    if (hasNewRole) {
      throw new Error('SECURITY VIOLATION: "+ New Role" button is visible to non-CEO (CFO)!');
    }
    console.log('✓ Verified: Button displays "+ Invite Dev / PM" and "+ New Role" button is NOT present for non-CEO (CFO).');

    await cfoPage.screenshot({ path: path.join(SCRATCH_DIR, '10_cfo_invitations_tab_restrictions.png') });
    console.log('  Screenshot: 10_cfo_invitations_tab_restrictions.png');

    // Click "+ Invite Dev / PM"
    console.log('Step 3.5: Clicking "+ Invite Dev / PM"...');
    await cfoPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#tab-actions button')).find((b) => b.textContent.includes('Invite Dev / PM'));
      if (btn) btn.click();
    });

    await cfoPage.waitForSelector('#modal-root #mform', { timeout: 5000 });

    // Verify modal title is "Send Invitation Link (PM & Developer)"
    const cfoModalTitle = await cfoPage.$eval('#modal-root h3', (el) => el.textContent.trim());
    console.log(`Step 3.6: CFO Modal Title: "${cfoModalTitle}"`);
    if (cfoModalTitle !== 'Send Invitation Link (PM & Developer)') {
      throw new Error(`Expected modal title "Send Invitation Link (PM & Developer)", got: "${cfoModalTitle}"`);
    }

    // Verify role dropdown contains ONLY DEVELOPER and PM (no executive roles, no custom roles)
    const cfoRoleOpts = await cfoPage.$$eval('#modal-root #mform select[name="role"] option', (opts) =>
      opts.map((o) => o.value)
    );
    console.log('Step 3.7: Roles in CFO invitation dropdown:', cfoRoleOpts.join(', '));
    if (cfoRoleOpts.length !== 2 || !cfoRoleOpts.includes('DEVELOPER') || !cfoRoleOpts.includes('PM')) {
      throw new Error(`CFO role dropdown must contain ONLY DEVELOPER and PM, but found: [${cfoRoleOpts.join(', ')}]`);
    }
    console.log('✓ Verified: Role dropdown contains ONLY DEVELOPER and PM (no executive roles, no custom roles).');

    await cfoPage.screenshot({ path: path.join(SCRATCH_DIR, '11_cfo_invite_modal_dropdown_restricted.png') });
    console.log('  Screenshot: 11_cfo_invite_modal_dropdown_restricted.png');

    await cfoPage.close();
    console.log('✓ TEST 3 PASSED: Non-CEO role restrictions strictly enforced.\n');

    // =========================================================================
    // TEST 4: Developer Acceptance & Onboarding
    // =========================================================================
    console.log('----------------------------------------------------------------');
    console.log('TEST 4: Developer Acceptance & Onboarding');
    console.log('----------------------------------------------------------------');

    const devPage = await browser.newPage();
    devPage.on('pageerror', (err) => console.error('[Dev Page Error]', err.message));

    const acceptUrl = `${BASE_URL}/#accept-invite?token=${capturedToken}`;
    console.log(`Step 4.1: Navigating to invitation URL: ${acceptUrl}`);
    await devPage.goto(acceptUrl, { waitUntil: 'networkidle0' });

    // Wait for accept-form
    await devPage.waitForSelector('#accept-form', { timeout: 10000 });
    await sleep(600);

    const acceptCardInfo = await devPage.evaluate(() => {
      const wrap = document.querySelector('.login-wrap');
      return wrap ? wrap.textContent : '';
    });
    console.log('Step 4.2: Invitation accept card loaded.');
    if (!acceptCardInfo.includes('manual_qa_dev@seu.edu.bd') || !acceptCardInfo.includes('DEVELOPER')) {
      throw new Error('Accept form does not display invited email or DEVELOPER role!');
    }
    console.log('✓ Verified: Card displays invited email "manual_qa_dev@seu.edu.bd" and role "DEVELOPER".');

    await devPage.screenshot({ path: path.join(SCRATCH_DIR, '12_dev_accept_invite_screen.png') });
    console.log('  Screenshot: 12_dev_accept_invite_screen.png');

    // Fill in full name, student ID, password & confirmation
    console.log('Step 4.3: Filling in activation credentials:');
    console.log('  - Full Legal Name: Asif Ahmed');
    console.log('  - Student ID: 2026QA9901');
    console.log('  - Password: ManualQAPassword2026!');

    await devPage.type('#accept-form input[name="fullName"]', 'Asif Ahmed');
    await devPage.type('#accept-form input[name="studentId"]', '2026QA9901');
    await devPage.type('#accept-form input[name="password"]', 'ManualQAPassword2026!');
    await devPage.type('#accept-form input[name="confirmPassword"]', 'ManualQAPassword2026!');

    await devPage.screenshot({ path: path.join(SCRATCH_DIR, '13_dev_accept_invite_filled.png') });
    console.log('  Screenshot: 13_dev_accept_invite_filled.png');

    // Submit "Activate Account & Enter Studio"
    console.log('Step 4.4: Submitting "Activate Account & Enter Studio"...');
    await devPage.click('#accept-form button[type="submit"]');

    // Wait for Developer dashboard to load
    await devPage.waitForSelector('.sidebar .userbox', { timeout: 12000 });
    await sleep(800);

    // Confirm Developer dashboard loads: verify userbox displays Name, Role (DEVELOPER), and Wallet (৳0)
    const devName = await devPage.$eval('.sidebar .userbox .name', (el) => el.textContent.trim());
    const devRole = await devPage.$eval('.sidebar .userbox .role', (el) => el.textContent.trim());
    const devWallet = await devPage.$eval('.sidebar .userbox .wallet', (el) => el.textContent.trim());

    console.log('Step 4.5: Developer Dashboard Userbox:');
    console.log(`  - Name: "${devName}" (expected: "Asif Ahmed")`);
    console.log(`  - Role: "${devRole}" (expected: "DEVELOPER")`);
    console.log(`  - Wallet: "${devWallet}" (expected: "৳0")`);

    if (devName !== 'Asif Ahmed') throw new Error(`Expected devName "Asif Ahmed", got "${devName}"`);
    if (devRole !== 'DEVELOPER') throw new Error(`Expected devRole "DEVELOPER", got "${devRole}"`);
    if (devWallet !== '৳0') throw new Error(`Expected devWallet "৳0", got "${devWallet}"`);
    console.log('✓ Verified: Userbox displays Name (Asif Ahmed), Role (DEVELOPER), and Wallet (৳0).');

    // Confirm Invitations tab is NOT present for DEVELOPER role
    const devNavTabs = await devPage.$$eval('.sidebar a.nav-btn', (els) => els.map((e) => e.textContent.trim()));
    console.log('Step 4.6: Developer sidebar navigation tabs:', devNavTabs.join(', '));

    if (devNavTabs.includes('Invitations')) {
      throw new Error('SECURITY VIOLATION: Invitations tab is visible to DEVELOPER role!');
    }
    console.log('✓ Verified: "Invitations" tab is strictly NOT present for DEVELOPER role.');

    await devPage.screenshot({ path: path.join(SCRATCH_DIR, '14_dev_dashboard_verified.png') });
    console.log('  Screenshot: 14_dev_dashboard_verified.png');

    // Database verification of activated developer
    const dbUser = await prisma.user.findUnique({
      where: { email: 'manual_qa_dev@seu.edu.bd' },
      include: { account: true },
    });
    const dbInvitation = await prisma.invitation.findFirst({
      where: { email: 'manual_qa_dev@seu.edu.bd' },
    });

    console.log('\nStep 4.7: Verifying Database Entities:');
    console.log('  User:', {
      id: dbUser?.id,
      email: dbUser?.email,
      fullName: dbUser?.fullName,
      role: dbUser?.role,
      studentId: dbUser?.studentId,
      isActive: dbUser?.isActive,
    });
    console.log('  Account:', {
      id: dbUser?.account?.id,
      type: dbUser?.account?.type,
      balance: dbUser?.account?.balance,
      currency: dbUser?.account?.currency,
    });
    console.log('  Invitation Status:', dbInvitation?.status, '| Accepted At:', dbInvitation?.acceptedAt);

    if (!dbUser || dbUser.role !== 'DEVELOPER' || dbUser.fullName !== 'Asif Ahmed' || dbUser.studentId !== '2026QA9901') {
      throw new Error('Database User verification failed!');
    }
    if (!dbUser.account || dbUser.account.type !== 'PERSONAL_WALLET' || Number(dbUser.account.balance) !== 0) {
      throw new Error('Database Wallet verification failed!');
    }
    if (!dbInvitation || dbInvitation.status !== 'ACCEPTED' || !dbInvitation.acceptedAt) {
      throw new Error('Database Invitation status verification failed!');
    }
    console.log('✓ Database state verified 100% compliant with studio business rules.');

    console.log('\n================================================================');
    console.log('ALL 4 TEST FLOWS PASSED SUCCESSFULLY WITH 100% SUCCESS');
    console.log('================================================================\n');

    await devPage.close();
    await page.close();
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

runManualQATest().catch((err) => {
  console.error('\n❌ QA Test Automation Suite Failed:\n', err);
  process.exit(1);
});
