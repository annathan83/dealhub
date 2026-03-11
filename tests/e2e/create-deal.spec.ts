import { test, expect } from '../fixtures';

/**
 * Create deal flow.
 * Uses seededDeal fixture so the deal is cleaned up after the test.
 */
test.describe('Create deal', () => {
  test('creates a deal via manual entry and navigates to deal page', async ({
    page,
    seededDeal,
  }) => {
    const { dealId, dealName } = seededDeal;

    await expect(page).toHaveURL(new RegExp(`/deals/${dealId}`));
    await expect(page.getByText(dealName)).toBeVisible();
  });
});
