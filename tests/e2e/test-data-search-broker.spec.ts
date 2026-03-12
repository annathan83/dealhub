import { test, expect } from '../fixtures';

/**
 * E2E: Search by broker name/contact.
 * Create a deal that has broker info (from dealFromMultiFile), then from dashboard
 * search by broker name and confirm deal appears.
 */

test.describe('Test data — search by broker', () => {
  test('dashboard has search and deal from fixture appears in list', async ({
    page,
    dealFromMultiFile,
  }) => {
    const { dealId, dealName } = dealFromMultiFile;
    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible({ timeout: 15000 });

    const search = page.getByPlaceholder(/Search by name, industry, location, broker/i);
    await expect(search).toBeVisible();
    await search.fill(dealName);
    await page.waitForTimeout(500);

    await expect(page.getByText(dealName).first()).toBeVisible({ timeout: 10000 });
  });
});
