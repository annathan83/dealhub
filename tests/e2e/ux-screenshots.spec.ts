import { test, expect } from '../fixtures';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.join(process.cwd(), 'ux-screenshots');

/**
 * UX review screenshots — all flows.
 * Requires PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in .env.local.
 * Run: npx playwright test --project=screenshots
 */
test.describe('UX review screenshots — all flows', () => {
  // requireAuth is called inside the seededDeal fixture
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('capture all flows', async ({ page, seededDeal }) => {
    const { dealId } = seededDeal;

    // ── Public pages (authenticated users are redirected — capture whatever loads) ──
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-landing-page.png'), fullPage: true });

    await page.goto('/signup');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-signup-page.png'), fullPage: true });

    await page.goto('/signin');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-signin-page.png'), fullPage: true });

    // ── Authenticated flows ─────────────────────────────────────────────
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-dashboard.png'), fullPage: true });

    await page.goto('/deals/new');
    await expect(page).toHaveURL('/deals/new');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-create-deal-paste-mode.png'), fullPage: true });

    await page.getByTestId('manual-entry-mode').click();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-create-deal-manual-mode.png'), fullPage: true });

    // ── Deal page tabs ──────────────────────────────────────────────────
    await page.goto(`/deals/${dealId}`);
    await expect(page).toHaveURL(new RegExp(`/deals/${dealId}`));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-deal-workspace-tab.png'), fullPage: true });

    await page.getByTestId('facts-tab-btn').click();
    await expect(page.getByRole('heading', { name: 'Facts' })).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-deal-facts-tab.png'), fullPage: true });

    await page.getByTestId('analysis-tab-btn').click();
    await expect(page.getByText('Deal Score', { exact: true })).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-deal-analysis-tab.png'), fullPage: true });

    // ── Settings ─────────────────────────────────────────────────────────────
    await page.goto('/settings/integrations');
    await expect(page).toHaveURL(/\/settings\/integrations/);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-settings-integrations.png'), fullPage: true });

    await page.goto('/settings/buyer-profile');
    await expect(page).toHaveURL(/\/settings\/buyer-profile/);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-settings-buyer-profile.png'), fullPage: true });

    // Scoring weights page removed in v1 — all metrics use simple average
  });
});
