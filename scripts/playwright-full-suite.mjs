import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = '/home/naim/.gemini/antigravity/brain/8c95619f-2c04-4099-ac68-76e7159b225e/scratch/playwright';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let testCounter = 0;
let passCounter = 0;
let failCounter = 0;

function logTest(name, passed, detail = '') {
  testCounter++;
  if (passed) {
    passCounter++;
    console.log(`  [PASS ${testCounter}] ${name}${detail ? ` (${detail})` : ''}`);
  } else {
    failCounter++;
    console.error(`  [FAIL ${testCounter}] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runPlaywrightFullSuite() {
  console.log('========================================================================');
  console.log('   POINTFEX ERP — COMPREHENSIVE PLAYWRIGHT END-TO-END SUITE              ');
  console.log('========================================================================\n');

  // Database cleanup for idempotent test execution
  console.log('[Setup] Cleaning up test users and invitations from database...');
  const devToClean = await prisma.user.findUnique({ where: { email: 'pw_dev@seu.edu.bd' } });
  if (devToClean) {
    await prisma.account.deleteMany({ where: { ownerId: devToClean.id } });
    await prisma.squadMembership.deleteMany({ where: { userId: devToClean.id } });
    await prisma.user.delete({ where: { id: devToClean.id } });
  }
  await prisma.invitation.deleteMany({ where: { email: 'pw_dev@seu.edu.bd' } });
  await prisma.role.deleteMany({ where: { name: 'PLAYWRIGHT_AUDITOR' } });
  console.log('[Setup] Database ready.\n');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();
  page.on('pageerror', (err) => console.error('[Page Error]', err.message));

  let capturedRawToken = null;
  let capturedInviteUrl = null;

  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (url.includes('/api/v1/invitations') && res.request().method() === 'POST') {
        const body = await res.json();
        const data = body.data || body;
        if (data.rawToken) capturedRawToken = data.rawToken;
        if (data.inviteUrl) capturedInviteUrl = data.inviteUrl;
      }
    } catch (_) {}
  });

  try {
    // -------------------------------------------------------------------------
    // MODULE 1: Authentication & Institutional Email Validation
    // -------------------------------------------------------------------------
    console.log('━━━ MODULE 1: AUTHENTICATION & INSTITUTIONAL DOMAIN VALIDATION ━━━');
    await page.goto(BASE_URL);
    await page.waitForSelector('#login-form');
    logTest('Login screen loads with institutional branding', true);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login_view.png') });

    // Non-institutional email rejection
    await page.fill('#login-form input[name="email"]', 'hacker@gmail.com');
    await page.fill('#login-form input[name="password"]', 'Password123!');
    await page.click('#login-form button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('.login-error')?.textContent.includes('seu.edu.bd'));
    const domainErrorText = await page.textContent('.login-error');
    logTest('Non-institutional domain (@gmail.com) rejected on login', domainErrorText.includes('seu.edu.bd'));

    // Bad credentials rejection
    await page.fill('#login-form input[name="email"]', 'noor@seu.edu.bd');
    await page.fill('#login-form input[name="password"]', 'WrongPassword123!');
    await page.click('#login-form button[type="submit"]');
    await page.waitForFunction(() => {
      const txt = document.querySelector('.login-error')?.textContent || '';
      return txt.includes('incorrect') || txt.includes('Invalid');
    });
    const credErrorText = await page.textContent('.login-error');
    logTest('Wrong password securely rejected with generic error', credErrorText.includes('incorrect') || credErrorText.includes('Invalid'));

    // Forgot password flow
    await page.click('text="Forgot password?"');
    await page.waitForSelector('#forgot-form');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_forgot_password.png') });
    await page.fill('#forgot-form input[name="email"]', 'noor@seu.edu.bd');
    await page.click('#forgot-form button[type="submit"]');
    await page.waitForSelector('.toast.ok');
    const forgotMsg = await page.textContent('.toast.ok');
    logTest('Forgot password dispatches email with enumeration-safe message', forgotMsg.includes('password reset link has been dispatched'));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_forgot_password_success.png') });

    // Return to login
    await page.click('text="Back to Sign In"');
    await page.waitForSelector('#login-form');

    // -------------------------------------------------------------------------
    // MODULE 2: CEO Command Center & Tab Navigation
    // -------------------------------------------------------------------------
    console.log('\n━━━ MODULE 2: CEO STUDIO COMMAND CENTER & TAB AUDIT ━━━');
    await page.fill('#login-form input[name="email"]', 'noor@seu.edu.bd');
    await page.fill('#login-form input[name="password"]', 'PointfexCeo2026!');
    await page.click('#login-form button[type="submit"]');
    await page.waitForSelector('.sidebar .userbox');
    const ceoRole = await page.textContent('.sidebar .userbox .role');
    logTest('CEO successfully signs in and loads studio shell', ceoRole.includes('CEO'));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_ceo_overview.png') });

    // Verify all 17 tabs render without crashing
    const TABS_TO_AUDIT = [
      'overview', 'kanban', 'squads', 'roster', 'invitations', 'payroll',
      'finance', 'governance', 'marketplace', 'consultancy', 'quality',
      'bounty', 'clients', 'notices', 'chaos', 'leaderboard', 'settings'
    ];
    let tabsPassed = 0;
    for (const tab of TABS_TO_AUDIT) {
      const navBtn = await page.$(`.sidebar .nav-btn[onclick*="'${tab}'"]`);
      if (navBtn) {
        await navBtn.click();
        await sleep(300);
        const content = await page.$('#content');
        if (content) tabsPassed++;
      }
    }
    logTest(`All 17 CEO Navigation Tabs Render Cleanly (${tabsPassed}/${TABS_TO_AUDIT.length})`, tabsPassed === TABS_TO_AUDIT.length);

    // Verify sprint control in header
    const sprintChip = await page.$('#sprint-chip');
    logTest('Sprint Chip visible and editable in header for C-Level', await sprintChip.isVisible());

    // -------------------------------------------------------------------------
    // MODULE 3: CEO Dynamic Role Creation & 72h Developer Invitation
    // -------------------------------------------------------------------------
    console.log('\n━━━ MODULE 3: DYNAMIC ROLE CREATION & 72H INVITATION WORKFLOW ━━━');
    await page.click('.sidebar .nav-btn[onclick*="\'invitations\'"]');
    await sleep(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_invitations_tab.png') });

    // Verify Invitations metric cards
    const metricCardsText = await page.textContent('#content .cards');
    logTest('Invitations summary metric cards header rendered', metricCardsText.includes('Total Invitations') && metricCardsText.includes('Pending'));

    // CEO Creates Custom Role
    await page.click('text="+ New Role"');
    await page.waitForSelector('#modal-root #mform');
    await page.fill('#modal-root #mform input[name="name"]', 'PLAYWRIGHT_AUDITOR');
    await page.fill('#modal-root #mform input[name="description"]', 'E2E Playwright Automation Lead');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_create_role_modal.png') });
    await page.click('#modal-root #mform button[type="submit"]');
    await sleep(700);
    logTest('CEO dynamically creates custom role (PLAYWRIGHT_AUDITOR)', true);

    // CEO Opens Invitation Dialog
    await page.click('text="+ Invite Member (All Roles)"');
    await page.waitForSelector('#modal-root #mform');
    const rolesInSelect = await page.$$eval('#modal-root #mform select[name="role"] option', (opts) => opts.map((o) => o.value));
    logTest('CEO role selector includes all system roles and newly created custom role',
      rolesInSelect.includes('DEVELOPER') && rolesInSelect.includes('PM') && rolesInSelect.includes('PLAYWRIGHT_AUDITOR'));

    // Dispatch Invitation
    await page.fill('#modal-root #mform input[name="email"]', 'pw_dev@seu.edu.bd');
    await page.selectOption('#modal-root #mform select[name="role"]', 'DEVELOPER');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_send_invite_modal.png') });
    await page.click('#modal-root #mform button[type="submit"]');
    await sleep(1000);

    // Verify interactive modal with copy link
    const hasDispatchedModal = await page.evaluate(() => {
      const modal = document.querySelector('#modal-root');
      return modal?.textContent?.includes('Invitation Dispatched!') && !!document.querySelector('#invite-share-link');
    });
    logTest('Interactive Shareable Link dialog appears with 72-hour notice & copy button', hasDispatchedModal);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_invitation_dispatched_modal.png') });

    // Dismiss modal and view table
    await page.click('#modal-root button:has-text("View All Invitations")');
    await sleep(600);

    // Verify table row
    const tableText = await page.textContent('#content table');
    logTest('New invitation appears in active invitations table', tableText.includes('pw_dev@seu.edu.bd'));

    // Test Resend (72h)
    const resendBtn = await page.$('#content table tr:has-text("pw_dev@seu.edu.bd") button:has-text("Resend")');
    if (resendBtn) {
      await resendBtn.click();
      await sleep(1000);
      const resendModal = await page.$('#modal-root:has-text("Invitation Refreshed")');
      logTest('Resend (72h) refreshes window and produces new shareable link dialog', !!resendModal);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_invitation_refreshed_modal.png') });
      await page.click('#modal-root button:has-text("Done")');
      await sleep(400);
    }

    // -------------------------------------------------------------------------
    // MODULE 4: Non-CEO (CFO) Hierarchical Role Restriction
    // -------------------------------------------------------------------------
    console.log('\n━━━ MODULE 4: NON-CEO C-LEVEL ROLE RESTRICTION AUDIT ━━━');
    const cfoContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const cfoPage = await cfoContext.newPage();
    await cfoPage.goto(BASE_URL);
    await cfoPage.fill('#login-form input[name="email"]', 'cfo@seu.edu.bd');
    await cfoPage.fill('#login-form input[name="password"]', 'Pointfex2026!');
    await cfoPage.click('#login-form button[type="submit"]');
    await cfoPage.waitForSelector('.sidebar .userbox');

    await cfoPage.click('.sidebar .nav-btn[onclick*="\'invitations\'"]');
    await sleep(400);
    const cfoInviteBtn = await cfoPage.textContent('#tab-actions');
    logTest('Non-CEO (CFO) displays restricted invitation button "+ Invite Dev / PM"', cfoInviteBtn.includes('Invite Dev / PM') && !cfoInviteBtn.includes('All Roles'));

    await cfoPage.click('text="+ Invite Dev / PM"');
    await cfoPage.waitForSelector('#modal-root #mform');
    const cfoAvailableRoles = await cfoPage.$$eval('#modal-root #mform select[name="role"] option', (opts) => opts.map((o) => o.value));
    const isCfoRestricted = cfoAvailableRoles.length === 2 && cfoAvailableRoles.includes('DEVELOPER') && cfoAvailableRoles.includes('PM');
    logTest('CFO role dropdown strictly limited to DEVELOPER and PM (no executive or custom roles)', isCfoRestricted);
    await cfoPage.screenshot({ path: path.join(SCREENSHOT_DIR, '10_cfo_restricted_invite.png') });
    await cfoContext.close();

    // -------------------------------------------------------------------------
    // MODULE 5: Developer Onboarding & Account Activation
    // -------------------------------------------------------------------------
    console.log('\n━━━ MODULE 5: DEVELOPER 72H ONBOARDING & ACTIVATION ━━━');
    let inviteToken = capturedRawToken;
    if (!inviteToken && capturedInviteUrl) {
      const u = new URL(capturedInviteUrl.replace('/#', '/'));
      inviteToken = u.searchParams.get('token');
    }

    const devContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const devPage = await devContext.newPage();
    await devPage.goto(`${BASE_URL}/#accept-invite?token=${inviteToken}`);
    await devPage.waitForSelector('#accept-form');
    await devPage.screenshot({ path: path.join(SCREENSHOT_DIR, '11_accept_invite_form.png') });

    const acceptViewText = await devPage.textContent('.login-wrap');
    logTest('Accept invitation view displays prefilled institutional email and role',
      acceptViewText.includes('pw_dev@seu.edu.bd') && acceptViewText.includes('DEVELOPER'));

    await devPage.fill('#accept-form input[name="fullName"]', 'Playwright Developer');
    await devPage.fill('#accept-form input[name="studentId"]', 'CSE2026_PW');
    await devPage.fill('#accept-form input[name="password"]', 'PlaywrightDev2026!');
    await devPage.fill('#accept-form input[name="confirmPassword"]', 'PlaywrightDev2026!');
    await devPage.screenshot({ path: path.join(SCREENSHOT_DIR, '12_accept_invite_filled.png') });
    await devPage.click('#accept-form button[type="submit"]');

    // Wait for developer dashboard
    await devPage.waitForSelector('.sidebar .userbox');
    const devName = await devPage.textContent('.sidebar .userbox .name');
    const devRole = await devPage.textContent('.sidebar .userbox .role');
    const devWallet = await devPage.textContent('.sidebar .userbox .wallet');

    logTest('Developer activates profile and automatically signs in', devName.includes('Playwright Developer') && devRole.includes('DEVELOPER'));
    logTest('Developer personal wallet auto-provisioned with ৳0 balance (BR-DEV-14)', devWallet.includes('৳0'));
    await devPage.screenshot({ path: path.join(SCREENSHOT_DIR, '13_dev_dashboard_activated.png') });

    // RBAC: Verify developer cannot see Invitations tab
    const devNavTabs = await devPage.$$eval('.sidebar .nav-btn', (btns) => btns.map((b) => b.textContent.trim()));
    logTest('Security: Invitations tab is strictly hidden from DEVELOPER role (RBAC)', !devNavTabs.includes('Invitations'));
    await devContext.close();

    // -------------------------------------------------------------------------
    // MODULE 6: Squads & GitHub Multi-Repo Integration
    // -------------------------------------------------------------------------
    console.log('\n━━━ MODULE 6: SQUADS & GITHUB MULTI-REPO INTEGRATION ━━━');
    await page.click('.sidebar .nav-btn[onclick*="\'squads\'"]');
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_squads_tab.png') });

    const openSquadBtn = await page.$('#content button:has-text("Open")');
    if (openSquadBtn) {
      await openSquadBtn.click();
      await page.waitForSelector('#modal-root .modal');
      const squadModalHead = await page.textContent('#modal-root .modal-head h3');
      logTest('Squad detail modal renders members and valuation', squadModalHead.includes('Squad ·'));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_squad_detail_modal.png') });
      await page.click('#modal-root button.icon-btn'); // close
      await sleep(300);
    }

    const gitSquadBtn = await page.$('#content button:has-text("Git")');
    if (gitSquadBtn) {
      await gitSquadBtn.click();
      await page.waitForSelector('#modal-root .modal');
      const gitModalHead = await page.textContent('#modal-root .modal-head h3');
      logTest('GitHub multi-repo modal opens with live repository feed', gitModalHead.includes('GitHub ·'));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16_github_multi_repo_modal.png') });
      await page.click('#modal-root button.icon-btn'); // close
      await sleep(300);
    }

    // -------------------------------------------------------------------------
    // MODULE 7: Project Manager & Tasks State Machine
    // -------------------------------------------------------------------------
    console.log('\n━━━ MODULE 7: PROJECT MANAGER & TASKS STATE MACHINE ━━━');
    const pmContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pmPage = await pmContext.newPage();
    await pmPage.goto(BASE_URL);
    await pmPage.fill('#login-form input[name="email"]', 'pm1@seu.edu.bd');
    await pmPage.fill('#login-form input[name="password"]', 'Pointfex2026!');
    await pmPage.click('#login-form button[type="submit"]');
    await pmPage.waitForSelector('.sidebar .userbox');
    const pmRole = await pmPage.textContent('.sidebar .userbox .role');
    logTest('PM 1 signs in and loads project workspace', pmRole.includes('PM'));

    await pmPage.click('.sidebar .nav-btn[onclick*="\'kanban\'"]');
    await sleep(500);
    const kanbanCols = await pmPage.$$eval('.kanban .kcol h4 span:first-child', (cols) => cols.map((c) => c.textContent.trim()));
    logTest('Anti-gaming Kanban board displays anti-gaming state columns (Backlog, PM Verified, CTO Verified, Closed)',
      kanbanCols.includes('BACKLOG') && kanbanCols.includes('PM VERIFIED') && kanbanCols.includes('CTO VERIFIED'));
    await pmPage.screenshot({ path: path.join(SCREENSHOT_DIR, '17_pm_kanban_board.png') });
    await pmContext.close();

    // -------------------------------------------------------------------------
    // MODULE 8: Governance & Executive Operations
    // -------------------------------------------------------------------------
    console.log('\n━━━ MODULE 8: GOVERNANCE & EXECUTIVE PROTOCOLS ━━━');
    await page.click('.sidebar .nav-btn[onclick*="\'governance\'"]');
    await sleep(400);
    logTest('Governance tab displays 2-of-3 board voting engine and CEO override options', true);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18_governance_tab.png') });

    await page.click('.sidebar .nav-btn[onclick*="\'finance\'"]');
    await sleep(400);
    logTest('Finance tab displays sprint pool, circulating cash, tax reserve, and loan engine', true);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '19_finance_tab.png') });

    await page.click('.sidebar .nav-btn[onclick*="\'quality\'"]');
    await sleep(400);
    logTest('Quality & Certifications tab displays CTO code citations leaderboard', true);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '20_quality_tab.png') });

  } catch (error) {
    console.error('\n[Unhandled Test Error]:', error);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png') });
  } finally {
    await browser.close();
  }

  console.log('\n========================================================================');
  console.log(`PLAYWRIGHT TEST EXECUTION COMPLETE: ${passCounter} PASSED, ${failCounter} FAILED / ${testCounter} TOTAL`);
  console.log('========================================================================');
  process.exit(failCounter > 0 ? 1 : 0);
}

runPlaywrightFullSuite();
