import { test, expect } from '../fixtures';
import { loadMultiFileDeal } from '../helpers/testData';

/**
 * E2E: Broker contact from test-data.
 * deal-001 has broker_name, broker_phone in expected.json; extraction may populate
 * deal.broker_* or contacts. Assert broker block or contact appears on deal detail.
 */

test.describe('Test data — broker contact', () => {
  test('deal from multi-file listing shows broker block or contact area', async ({
    page,
    dealFromMultiFile,
  }) => {
    const { dealId, expected } = dealFromMultiFile;
    await page.goto(`/deals/${dealId}`);

    await expect(page.getByText(/Broker|Contact|broker contact/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('deal list search placeholder includes broker', async ({ page }) => {
    const { hasAuthSession } = await import('../helpers/requireAuth');
    test.skip(!hasAuthSession(), 'Skipped: no auth session.');

    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible({ timeout: 15000 });
    const search = page.getByPlaceholder(/Search by name, industry, location/i);
    await expect(search).toBeVisible();
    await expect(search).toHaveAttribute('placeholder', /broker/);
  });
});
