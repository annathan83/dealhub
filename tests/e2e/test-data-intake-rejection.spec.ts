import { test, expect } from '../fixtures';
import { loadListing } from '../helpers/testData';

/**
 * E2E: Intake rejection flow (optional).
 * Use a listing that may trigger triage rejection (e.g. low score / PROBABLY_PASS).
 * Assert either: rejection screen with "Keep anyway" / "Dismiss", or deal created.
 * Cleanup only if deal was created.
 */

test.describe('Test data — intake rejection', () => {
  test('new deal flow shows either create form or rejection screen', async ({ page }) => {
    const { hasAuthSession } = await import('../helpers/requireAuth');
    test.skip(!hasAuthSession(), 'Skipped: no auth session.');

    const { listingText } = loadListing('040');
    await page.goto('/deals/new');
    await page.getByTestId('paste-listing').fill(listingText);
    await page.getByTestId('extract-facts').click();

    await expect(
      page
        .getByTestId('create-deal-submit')
        .or(page.getByRole('button', { name: /keep anyway|dismiss/i }))
        .or(page.getByText(/doesn't fit|not a fit|reject/i))
    ).toBeVisible({ timeout: 40000 });
  });
});
