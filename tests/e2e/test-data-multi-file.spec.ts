import { test, expect } from '../fixtures';

/**
 * E2E: Multi-file deal test-data (test-data/multi-file-deals/).
 * Creates deal from listing.txt only (current flow is single-paste); asserts deal page
 * and that key facts are in the expected range from expected.json.
 */

test.describe('Test data — multi-file deal', () => {
  test('creates deal from multi-file listing (deal-001) and deal page loads', async ({
    page,
    dealFromMultiFile,
  }) => {
    const { dealId, dealName, expected } = dealFromMultiFile;
    await expect(page).toHaveURL(new RegExp(`/deals/${dealId}`));
    await expect(page.getByText(dealName)).toBeVisible();

    await page.goto(`/deals/${dealId}`);
    await expect(page.getByTestId('facts-tab-btn')).toBeVisible();
  });

  test('multi-file deal shows industry and location from expected', async ({
    page,
    dealFromMultiFile,
  }) => {
    const { dealId, expected } = dealFromMultiFile;
    await page.goto(`/deals/${dealId}`);

    await page.getByTestId('facts-tab-btn').click();
    await expect(page.getByTestId('facts-tab')).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(new RegExp(expected.industry, 'i')).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(new RegExp(expected.location.replace(', ', '|'), 'i')).first()).toBeVisible({
      timeout: 5000,
    });
  });
});
