import { test, expect } from '@playwright/test';
import { requireAuth } from '../helpers/requireAuth';

/**
 * Authenticated dashboard smoke test.
 * Requires PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in .env.local.
 */
test.describe('Dashboard (authenticated)', () => {
  requireAuth();

  test('dashboard loads when authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
    await expect(page.getByTestId('create-deal-button')).toBeVisible();
  });
});
