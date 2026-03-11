import { test as base, expect } from '@playwright/test';
import { loadHvacCleanTestData, type HvacCleanExpected } from './helpers/hvacClean';
import { hasAuthSession } from './helpers/requireAuth';

/**
 * Reusable fixtures for DealHub Playwright tests.
 *
 * - seededDeal: creates a minimal deal, tears it down after the test
 * - hvacCleanDeal: creates hvac-clean golden deal from testdata, tears it down after
 *
 * Both fixtures call requireAuth() so tests skip immediately with a clear message
 * when credentials are not configured, instead of timing out.
 */

type DealFixture = {
  dealId: string;
  dealName: string;
};

type HvacCleanDealFixture = DealFixture & {
  expected: HvacCleanExpected;
};

export const test = base.extend<{ seededDeal: DealFixture; hvacCleanDeal: HvacCleanDealFixture }>({
  seededDeal: async ({ page, request }, use) => {
    base.skip(!hasAuthSession(), 'Skipped: no auth session. Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in .env.local.');

    const dealName = `E2E Deal ${Date.now()}`;
    await page.goto('/deals/new');
    await page.getByTestId('manual-entry-mode').click();
    await page.locator('#asking-price').fill('500000');
    await page.locator('#sde-cashflow').fill('120000');
    // Category must be set before Industry (Industry dropdown is disabled until then)
    await page.locator('#industry_category').selectOption('Home Services');
    await expect(page.locator('#industry')).toBeEnabled();
    await page.locator('#industry').selectOption('HVAC');
    await page.locator('#state').selectOption('FL');
    await page.getByTestId('deal-name-input').fill(dealName);
    await expect(page.getByTestId('create-deal-submit')).toBeEnabled();
    await page.getByTestId('create-deal-submit').click();

    // Wait for deal creation + initial AI scoring + redirect (OpenAI can be slow)
    await expect(page).toHaveURL(/\/deals\/[a-f0-9-]+/, { timeout: 90000 });
    const url = page.url();
    const match = url.match(/\/deals\/([a-f0-9-]+)/);
    const dealId = match?.[1] ?? '';

    await use({ dealId, dealName });

    // Teardown: delete deal so test runs don't accumulate orphaned records
    if (dealId) {
      await request.delete(`/api/deals/${dealId}`).catch(() => {
        // Non-fatal: log but don't fail the test on cleanup errors
        console.warn(`[fixture] Failed to delete deal ${dealId} during teardown`);
      });
    }
  },

  hvacCleanDeal: async ({ page, request }, use) => {
    base.skip(!hasAuthSession(), 'Skipped: no auth session. Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in .env.local.');

    const { listingText, expected } = loadHvacCleanTestData();

    await page.goto('/deals/new');
    await page.getByTestId('paste-listing').fill(listingText);
    await page.getByTestId('extract-facts').click();

    await expect(page.getByTestId('create-deal-submit')).toBeVisible({ timeout: 30000 });
    await page.getByTestId('deal-name-input').fill(expected.dealName);
    await page.getByTestId('create-deal-submit').click();

    await expect(page).toHaveURL(/\/deals\/[a-f0-9-]+/);
    const url = page.url();
    const match = url.match(/\/deals\/([a-f0-9-]+)/);
    const dealId = match?.[1] ?? '';

    await use({ dealId, dealName: expected.dealName, expected });

    if (dealId) {
      await request.delete(`/api/deals/${dealId}`).catch(() => {
        console.warn(`[fixture] Failed to delete deal ${dealId} during teardown`);
      });
    }
  },
});

export { expect };
