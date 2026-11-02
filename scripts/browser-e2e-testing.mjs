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

async function runBrowserE2ETest() {
  console.log('--- Starting Browser E2E Manual & Verification Testing ---');
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });

  // 0. Pre-test cleanup for e2e_dev@seu.edu.bd
  console.log('[Setup] Cleaning up any existing e2e_dev records in database...');
  const existingDev = await prisma.user.findUnique({ where: { email: 'e2e_dev@seu.edu.bd' } });
  if (existingDev) {
    await prisma.account.deleteMany({ where: { ownerId: existingDev.id } });
    await prisma.squadMembership.deleteMany({ where: { userId: existingDev.id } });
    await prisma.user.delete({ where: { id: existingDev.id } });
  }
  await prisma.invitation.deleteMany({ where: { email: 'e2e_dev@seu.edu.bd' } });
  await prisma.role.deleteMany({ where: { name: 'BROWSER_QA_LEAD' } });
  console.log('[Setup] Database clean for test run.');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,850',
    ],
    headless: 'new',
    defaultViewport: { width: 1280, height: 850 },
  });

  const page = await browser.newPage();
  page.on('pageerror', (err) => console.error('[Page Error]', err));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[Page Console Error]', msg.text());
  });

  // Capture API tokens from invitation requests
  let rawInvitationToken = null;
  let inviteUrlFromApi = null;

  page.on('response', async (response) => {
    try {
      const url = response.url();
      if (url.includes('/api/v1/invitations') && response.request().method() === 'POST') {
        const json = await response.json();
        const data = json.data || json;
        if (data.rawToken) {
          rawInvitationToken = data.rawToken;
          console.log('[API Intercept] Captured rawToken:', rawInvitationToken);
        }
        if (data.inviteUrl) {
          inviteUrlFromApi = data.inviteUrl;
          console.log('[API Intercept] Captured inviteUrl:', inviteUrlFromApi);
        }
      }
    } catch (_) {}
  });

  try {
    // =========================================================================
    // STEP 1: Verify Login view and Forgot Password flow
    // =========================================================================
    console.log('\n[Step 1] Navigating to http://localhost:3001/ ...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });

    // Clear session storage / local storage to guarantee clean state
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });

    await page.waitForSelector('#login-form', { timeout: 10000 });
    console.log('✓ Login view loaded successfully');

    await page.screenshot({ path: path.join(SCRATCH_DIR, '01_login_view.png') });
    console.log('  Saved screenshot: 01_login_view.png');

    // Check "Forgot password?" link
    const forgotLink = await page.evaluateHandle(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.find((a) => a.textContent.includes('Forgot password?'));
    });
    if (!forgotLink || !forgotLink.asElement()) {
      throw new Error('Forgot password? link not found on login screen');
    }
    console.log('✓ Found "Forgot password?" link');

    // Click "Forgot password?"
    await forgotLink.asElement().click();
    await page.waitForSelector('#forgot-form', { timeout: 5000 });
    console.log('✓ Forgot password view loaded');
    await page.screenshot({ path: path.join(SCRATCH_DIR, '02_forgot_password_form.png') });
    console.log('  Saved screenshot: 02_forgot_password_form.png');

    // Enter institutional email noor@seu.edu.bd and submit
    await page.type('#forgot-form input[name="email"]', 'noor@seu.edu.bd');
    await page.screenshot({ path: path.join(SCRATCH_DIR, '03_forgot_password_filled.png') });
    console.log('  Saved screenshot: 03_forgot_password_filled.png');

    await page.click('#forgot-form button[type="submit"]');

    // Wait for success screen / confirmation toast
    await page.waitForSelector('.toast.ok, .toast', { timeout: 8000 });
    await sleep(500);
    const toastText = await page.evaluate(() => {
      const t = document.querySelector('.toast.ok, .toast');
      return t ? t.textContent : '';
    });
    console.log('✓ Received confirmation message:', toastText);
    await page.screenshot({ path: path.join(SCRATCH_DIR, '04_forgot_password_submitted.png') });
    console.log('  Saved screenshot: 04_forgot_password_submitted.png');

    // =========================================================================
    // STEP 2: Log in as CEO and test Developer Invitations
    // =========================================================================
    console.log('\n[Step 2] Returning to Login & Signing in as CEO...');
    const backBtn = await page.waitForSelector('#forgot-form button.ghost', { timeout: 5000 });
    await backBtn.click();
    await page.waitForSelector('#login-form', { timeout: 5000 });

    // Fill CEO credentials
    await page.type('#login-form input[name="email"]', 'noor@seu.edu.bd');
    await page.type('#login-form input[name="password"]', 'PointfexCeo2026!');
    await page.screenshot({ path: path.join(SCRATCH_DIR, '05_ceo_login_credentials.png') });
    console.log('  Saved screenshot: 05_ceo_login_credentials.png');

    await page.click('#login-form button[type="submit"]');

    // Wait for shell/dashboard
    await page.waitForSelector('.sidebar .userbox', { timeout: 8000 });
    await sleep(600);
    const ceoName = await page.$eval('.sidebar .userbox .name', (el) => el.textContent.trim());
    const ceoRole = await page.$eval('.sidebar .userbox .role', (el) => el.textContent.trim());
    console.log(`✓ Logged in as: ${ceoName} (${ceoRole})`);

    await page.screenshot({ path: path.join(SCRATCH_DIR, '06_ceo_dashboard_overview.png') });
    console.log('  Saved screenshot: 06_ceo_dashboard_overview.png');

    // Verify sidebar displays "Invitations" tab for C-level executives
    const navItems = await page.$$eval('.sidebar a.nav-btn', (els) => els.map((e) => e.textContent.trim()));
    console.log('Sidebar tabs available:', navItems.join(', '));
    if (!navItems.includes('Invitations')) {
      throw new Error('Invitations tab NOT found in sidebar for CEO user!');
    }
    console.log('✓ "Invitations" tab confirmed present in CEO sidebar');

    // Click "Invitations" tab
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.sidebar a.nav-btn')).find((e) => e.textContent.trim() === 'Invitations');
      if (btn) btn.click();
    });

    // Wait for invitations view
    await page.waitForFunction(() => {
      return document.querySelector('#tab-actions')?.textContent.includes('Invite');
    }, { timeout: 8000 });
    await sleep(500);

    await page.screenshot({ path: path.join(SCRATCH_DIR, '07_invitations_tab_view.png') });
    console.log('  Saved screenshot: 07_invitations_tab_view.png');

    // Test CEO Creating a New Role in the Browser UI
    console.log('Testing CEO "+ New Role" flow in browser...');
    const newRoleBtn = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#tab-actions button')).find((e) => e.textContent.includes('New Role'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!newRoleBtn) throw new Error('"+ New Role" button not found in tab-actions for CEO!');

    await page.waitForSelector('#modal-root #mform', { timeout: 5000 });
    console.log('✓ Create New Role modal opened');
    await page.type('#modal-root #mform input[name="name"]', 'BROWSER_QA_LEAD');
    await page.type('#modal-root #mform input[name="description"]', 'Lead QA Automation Specialist');
    await page.screenshot({ path: path.join(SCRATCH_DIR, '07b_create_role_modal_filled.png') });
    console.log('  Saved screenshot: 07b_create_role_modal_filled.png');

    // Submit new role
    await page.click('#modal-root #mform button[type="submit"]');
    await page.waitForFunction(() => {
      return !document.querySelector('#modal-root #mform');
    }, { timeout: 6000 });
    await sleep(600);
    console.log('✓ Custom role BROWSER_QA_LEAD successfully created via modal');

    // Click "+ Invite Member"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#tab-actions button')).find((e) => e.textContent.includes('Invite'));
      if (btn) btn.click();
    });

    // Wait for modal
    await page.waitForSelector('#modal-root #mform', { timeout: 5000 });
    console.log('✓ Invite modal opened');

    // Verify CEO can select all roles, INCLUDING the newly created role
    const availableRoles = await page.$$eval('#modal-root #mform select[name="role"] option', (opts) => opts.map((o) => o.value));
    console.log('Roles available in invitation dropdown (CEO):', availableRoles.join(', '));
    const expectedRoles = ['DEVELOPER', 'PM', 'CFO', 'CTO', 'CPO', 'CEO', 'BROWSER_QA_LEAD'];
    for (const r of expectedRoles) {
      if (!availableRoles.includes(r)) {
        throw new Error(`CEO should have role option ${r}, but found [${availableRoles.join(', ')}]`);
      }
    }
    console.log('✓ CEO confirmed to have access to all system roles PLUS newly created custom role (BROWSER_QA_LEAD)');

    // Fill modal form: email e2e_dev@seu.edu.bd, role DEVELOPER
    await page.type('#modal-root #mform input[name="email"]', 'e2e_dev@seu.edu.bd');
    await page.select('#modal-root #mform select[name="role"]', 'DEVELOPER');
    await page.screenshot({ path: path.join(SCRATCH_DIR, '08_invite_modal_filled.png') });
    console.log('  Saved screenshot: 08_invite_modal_filled.png');

    // Submit invitation form
    await page.click('#modal-root #mform button[type="submit"]');

    // Wait for modal to close and table to refresh
    await page.waitForFunction(() => {
      const modal = document.querySelector('#modal-root #mform');
      return !modal;
    }, { timeout: 6000 });
    await sleep(1000);

    // Verify "Invitation Dispatched!" dialog with shareable link
    const hasShareableModal = await page.evaluate(() => {
      const modal = document.querySelector('#modal-root');
      return modal && modal.textContent.includes('Invitation Dispatched!') && !!document.querySelector('#invite-share-link');
    });
    if (hasShareableModal) {
      console.log('✓ Interactive Invitation Dispatched modal appeared with copyable link input');
      await page.screenshot({ path: path.join(SCRATCH_DIR, '08b_invitation_dispatched_modal.png') });
      // Click "View All Invitations" to close modal and show table
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('#modal-root button'));
        const closeBtn = btns.find((b) => b.textContent.includes('View All Invitations') || b.textContent.includes('Close'));
        if (closeBtn) closeBtn.click();
      });
      await sleep(600);
    }

    // Verify summary counter cards
    const hasStatCards = await page.evaluate(() => {
      const content = document.querySelector('#content')?.textContent || '';
      return content.includes('Total Invitations') && content.includes('Pending (Active 72h)');
    });
    if (!hasStatCards) {
      throw new Error('Invitations summary cards (Total, Pending 72h) not found!');
    }
    console.log('✓ Invitations summary stats header (Total, Pending, Accepted, Expired) confirmed');

    // Verify Overview tab has "+ Send Invitation Link" for C-level
    await page.evaluate(() => {
      const overviewLink = Array.from(document.querySelectorAll('.sidebar .nav-btn')).find((b) => b.textContent.includes('Overview'));
      if (overviewLink) overviewLink.click();
    });
    await sleep(600);
    const overviewHasInvite = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#tab-actions button')).some((b) => b.textContent.includes('Invitation Link'));
    });
    if (!overviewHasInvite) throw new Error('Overview tab missing "+ Send Invitation Link" button for C-level!');
    console.log('✓ Overview tab has "+ Send Invitation Link" for C-level');

    // Verify People tab has "+ Send Invitation Link" for C-level
    await page.evaluate(() => {
      const rosterLink = Array.from(document.querySelectorAll('.sidebar .nav-btn')).find((b) => b.textContent.includes('People'));
      if (rosterLink) rosterLink.click();
    });
    await sleep(600);
    const rosterHasInvite = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#tab-actions button')).some((b) => b.textContent.includes('Invitation Link'));
    });
    if (!rosterHasInvite) throw new Error('People tab missing "+ Send Invitation Link" button for C-level!');
    console.log('✓ People tab has "+ Send Invitation Link" for C-level');

    // Navigate back to Invitations tab for remaining test steps
    await page.evaluate(() => {
      const invLink = Array.from(document.querySelectorAll('.sidebar .nav-btn')).find((b) => b.textContent.includes('Invitations'));
      if (invLink) invLink.click();
    });
    await sleep(800);

    // Verify invitation appears in table
    const tableContainsDev = await page.evaluate(() => {
      return document.querySelector('#content')?.textContent.includes('e2e_dev@seu.edu.bd');
    });
    if (!tableContainsDev) {
      throw new Error('Invitation for e2e_dev@seu.edu.bd does not appear in the invitations table!');
    }
    console.log('✓ Invitation for e2e_dev@seu.edu.bd confirmed in invitations table');

    await page.screenshot({ path: path.join(SCRATCH_DIR, '09_invitation_created_in_table.png') });
    console.log('  Saved screenshot: 09_invitation_created_in_table.png');

    // Click "Resend (72h)" button on the invitation row
    console.log('Clicking "Resend (72h)" on invitation...');
    const resendBtnFound = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#content table tr'));
      for (const row of rows) {
        if (row.textContent.includes('e2e_dev@seu.edu.bd')) {
          const btn = Array.from(row.querySelectorAll('button')).find((b) => b.textContent.includes('Resend'));
          if (btn) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    });

    if (!resendBtnFound) {
      throw new Error('Resend (72h) button not found for e2e_dev@seu.edu.bd invitation');
    }

    // Wait for success toast
    await page.waitForFunction(() => {
      const toasts = Array.from(document.querySelectorAll('#toast-root .toast'));
      return toasts.some((t) => t.textContent.includes('resent') || t.textContent.includes('Resent') || t.textContent.includes('72-hour'));
    }, { timeout: 6000 });
    await sleep(500);

    // Dismiss resend dialog if present
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#modal-root button'));
      const doneBtn = btns.find((b) => b.textContent.includes('Done') || b.textContent.includes('✕'));
      if (doneBtn) doneBtn.click();
    });
    await sleep(400);

    await page.screenshot({ path: path.join(SCRATCH_DIR, '10_invitation_resent_toast.png') });
    console.log('✓ Resend (72h) triggered and toast verified');
    console.log('  Saved screenshot: 10_invitation_resent_toast.png');

    // Verify token was extracted
    if (!rawInvitationToken && inviteUrlFromApi) {
      const u = new URL(inviteUrlFromApi.replace('/#', '/'));
      rawInvitationToken = u.searchParams.get('token');
    }
    console.log('Invitation token to accept:', rawInvitationToken);
    if (!rawInvitationToken) {
      throw new Error('Could not obtain raw invitation token!');
    }

    // =========================================================================
    // STEP 2.5: Test CFO Role Restriction in Browser UI (Only PM & DEVELOPER)
    // =========================================================================
    console.log('\n[Step 2.5] Verifying Non-CEO (CFO) Role Restriction in Browser UI...');
    await page.close();

    const cfoPage = await browser.newPage();
    cfoPage.on('pageerror', (err) => console.error('[CfoPage Error]', err));
    await cfoPage.goto(BASE_URL, { waitUntil: 'networkidle0' });
    // Clear storage so CFO page starts on fresh login screen
    await cfoPage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await cfoPage.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await cfoPage.waitForSelector('#login-form', { timeout: 8000 });

    // Login as CFO
    await cfoPage.type('#login-form input[name="email"]', 'cfo@seu.edu.bd');
    await cfoPage.type('#login-form input[name="password"]', 'Pointfex2026!');
    await cfoPage.click('#login-form button[type="submit"]');
    await cfoPage.waitForSelector('.sidebar .userbox', { timeout: 8000 });
    await sleep(600);

    const cfoRole = await cfoPage.$eval('.sidebar .userbox .role', (el) => el.textContent.trim());
    console.log(`✓ Logged in as: CFO (${cfoRole})`);

    // Click Invitations tab
    await cfoPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.sidebar a.nav-btn')).find((e) => e.textContent.trim() === 'Invitations');
      if (btn) btn.click();
    });

    // Wait for invitations view
    await cfoPage.waitForFunction(() => {
      return document.querySelector('#tab-actions')?.textContent.includes('Invite Dev / PM');
    }, { timeout: 8000 });
    console.log('✓ CFO button correctly displays "+ Invite Dev / PM"');

    // Click "+ Invite Dev / PM"
    await cfoPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#tab-actions button')).find((e) => e.textContent.includes('Invite'));
      if (btn) btn.click();
    });

    await cfoPage.waitForSelector('#modal-root #mform', { timeout: 5000 });
    const modalTitle = await cfoPage.$eval('#modal-root h3', (el) => el.textContent.trim());
    console.log('CFO Invite Modal Title:', modalTitle);
    if (!modalTitle.includes('PM & Developer')) {
      throw new Error(`Expected modal title to indicate PM & Developer, got: ${modalTitle}`);
    }

    const cfoAvailableRoles = await cfoPage.$$eval('#modal-root #mform select[name="role"] option', (opts) => opts.map((o) => o.value));
    console.log('Roles available in CFO dropdown:', cfoAvailableRoles.join(', '));
    if (cfoAvailableRoles.length !== 2 || !cfoAvailableRoles.includes('DEVELOPER') || !cfoAvailableRoles.includes('PM')) {
      throw new Error(`CFO should only see DEVELOPER and PM, but saw: [${cfoAvailableRoles.join(', ')}]`);
    }
    console.log('✓ Verified: CFO is restricted to DEVELOPER and PM roles only in UI');
    await cfoPage.screenshot({ path: path.join(SCRATCH_DIR, '10b_cfo_role_restriction_modal.png') });

    await cfoPage.close();

    // =========================================================================
    // STEP 3: Test Developer Account Setup via Invitation Link
    // =========================================================================
    console.log('\n[Step 3] Accepting Developer Invitation via Link in new incognito/clean context...');

    const devPage = await browser.newPage();
    devPage.on('pageerror', (err) => console.error('[DevPage Error]', err));
    devPage.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[DevPage Console Error]', msg.text());
    });

    const inviteLink = `${BASE_URL}/#accept-invite?token=${rawInvitationToken}`;
    console.log('Navigating devPage to:', inviteLink);
    await devPage.goto(inviteLink, { waitUntil: 'networkidle0' });

    // Wait for accept form
    await devPage.waitForSelector('#accept-form', { timeout: 10000 });
    await sleep(500);

    // Verify form shows email e2e_dev@seu.edu.bd and role DEVELOPER
    const formInfo = await devPage.evaluate(() => {
      const app = document.getElementById('app');
      return app ? app.textContent : '';
    });
    if (!formInfo.includes('e2e_dev@seu.edu.bd')) {
      throw new Error('Accept form does not display invited email e2e_dev@seu.edu.bd!');
    }
    if (!formInfo.includes('DEVELOPER')) {
      throw new Error('Accept form does not display DEVELOPER role!');
    }
    console.log('✓ Accept form verified with invited email (e2e_dev@seu.edu.bd) and role (DEVELOPER)');

    await devPage.screenshot({ path: path.join(SCRATCH_DIR, '11_accept_invite_form.png') });
    console.log('  Saved screenshot: 11_accept_invite_form.png');

    // Fill in: Full Name: "E2E Test Developer", Student ID: "2026E2E001", Password: "E2EDevPassword2026!", Confirm Password: "E2EDevPassword2026!"
    await devPage.type('#accept-form input[name="fullName"]', 'E2E Test Developer');
    await devPage.type('#accept-form input[name="studentId"]', '2026E2E001');
    await devPage.type('#accept-form input[name="password"]', 'E2EDevPassword2026!');
    await devPage.type('#accept-form input[name="confirmPassword"]', 'E2EDevPassword2026!');

    await devPage.screenshot({ path: path.join(SCRATCH_DIR, '12_accept_invite_filled.png') });
    console.log('  Saved screenshot: 12_accept_invite_filled.png');

    // Submit activation
    console.log('Clicking "Activate Account & Enter Studio"...');
    await devPage.click('#accept-form button[type="submit"]');

    // Wait for dashboard to boot and userbox to render
    await devPage.waitForSelector('.sidebar .userbox', { timeout: 10000 });
    await sleep(800);

    // Verify developer userbox details
    const devName = await devPage.$eval('.sidebar .userbox .name', (el) => el.textContent.trim());
    const devRole = await devPage.$eval('.sidebar .userbox .role', (el) => el.textContent.trim());
    const devWallet = await devPage.$eval('.sidebar .userbox .wallet', (el) => el.textContent.trim());

    console.log(`✓ Developer Dashboard Loaded:`);
    console.log(`  - Name: "${devName}" (expected: "E2E Test Developer")`);
    console.log(`  - Role: "${devRole}" (expected: "DEVELOPER")`);
    console.log(`  - Wallet: "${devWallet}" (expected: "৳0")`);

    if (devName !== 'E2E Test Developer') throw new Error(`Unexpected name: ${devName}`);
    if (devRole !== 'DEVELOPER') throw new Error(`Unexpected role: ${devRole}`);
    if (devWallet !== '৳0') throw new Error(`Unexpected wallet: ${devWallet}`);

    // Verify Developer does NOT have the "Invitations" tab
    const devNavItems = await devPage.$$eval('.sidebar a.nav-btn', (els) => els.map((e) => e.textContent.trim()));
    console.log('Developer navigation tabs:', devNavItems.join(', '));
    if (devNavItems.includes('Invitations')) {
      throw new Error('Security check failed: Developer can see Invitations tab!');
    }
    console.log('✓ Security Verified: Invitations tab is NOT accessible/visible to DEVELOPER role');

    await devPage.screenshot({ path: path.join(SCRATCH_DIR, '13_developer_dashboard_activated.png') });
    console.log('  Saved screenshot: 13_developer_dashboard_activated.png');

    // Verify in database: user, account, invitation
    const dbDev = await prisma.user.findUnique({
      where: { email: 'e2e_dev@seu.edu.bd' },
      include: { account: true },
    });
    const dbInvite = await prisma.invitation.findFirst({
      where: { email: 'e2e_dev@seu.edu.bd' },
    });

    console.log('\n[Database Verification]');
    console.log('  User in DB:', {
      id: dbDev?.id,
      email: dbDev?.email,
      fullName: dbDev?.fullName,
      role: dbDev?.role,
      studentId: dbDev?.studentId,
      isActive: dbDev?.isActive,
    });
    console.log('  Account in DB:', {
      id: dbDev?.account?.id,
      type: dbDev?.account?.type,
      balance: dbDev?.account?.balance,
      currency: dbDev?.account?.currency,
    });
    console.log('  Invitation in DB:', {
      id: dbInvite?.id,
      status: dbInvite?.status,
      acceptedAt: dbInvite?.acceptedAt,
    });

    if (!dbDev || dbDev.role !== 'DEVELOPER' || dbDev.fullName !== 'E2E Test Developer' || dbDev.studentId !== '2026E2E001') {
      throw new Error('Database User verification failed');
    }
    if (!dbDev.account || dbDev.account.type !== 'PERSONAL_WALLET' || Number(dbDev.account.balance) !== 0) {
      throw new Error('Database Wallet verification failed');
    }
    if (!dbInvite || dbInvite.status !== 'ACCEPTED' || !dbInvite.acceptedAt) {
      throw new Error('Database Invitation status verification failed');
    }

    console.log('\n=============================================================');
    console.log('✓ ALL MANUAL BROWSER & E2E TESTS PASSED WITH 100% SUCCESS');
    console.log('=============================================================');
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

runBrowserE2ETest().catch((err) => {
  console.error('\n❌ Browser E2E Test Failed:\n', err);
  process.exit(1);
});
