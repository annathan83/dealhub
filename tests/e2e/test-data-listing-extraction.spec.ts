import { test, expect } from '../fixtures';
import { loadListing } from '../helpers/testData';

/**
 * E2E: Listing extraction using test-data/listings/.
 * - Clean/semi-structured listing: extract and create deal successfully.
 * - Messy listing: extract completes (may have lower confidence).
 * - Missing-field listing: may show rejection or TBD; submit still possible or "Keep anyway".
 */

test.describe('Test data — listing extraction', () => {
  test('creates deal from clean listing (listing_010)', async ({ page, dealFromListing }) => {
    const { dealId, dealName, listingId } = dealFromListing;
    await expect(page).toHaveURL(new RegExp(`/deals/${dealId}`));
    await expect(page.getByText(dealName)).toBeVisible();
    await expect(page.getByText(listingId, { exact: false })).toBeVisible();
  });

  test('deal page has facts tab and analysis after listing extraction', async ({
    page,
    dealFromListing,
  }) => {
    const { dealId } = dealFromListing;
    await page.goto(`/deals/${dealId}`);
    await expect(page.getByTestId('facts-tab-btn')).toBeVisible();
    await expect(page.getByTestId('analysis-tab-btn')).toBeVisible();
    await page.getByTestId('facts-tab-btn').click();
    await expect(page.getByTestId('facts-tab')).toBeVisible({ timeout: 10000 });
  });

  test('creates deal from semi-structured listing (listing_001)', async ({
    page,
    request,
  }) => {
    const { hasAuthSession } = await import('../helpers/requireAuth');
    test.skip(!hasAuthSession(), 'Skipped: no auth session.');

    const { listingText, listingId } = loadListing('001');
    const dealName = `E2E ${listingId} ${Date.now()}`;

    await page.goto('/deals/new');
    await page.getByTestId('paste-listing').fill(listingText);
    await page.getByTestId('extract-facts').click();

    await expect(page.getByTestId('create-deal-submit')).toBeVisible({ timeout: 30000 });
    await page.getByTestId('deal-name-input').fill(dealName);
    await page.getByTestId('create-deal-submit').click();

    await expect(page).toHaveURL(/\/deals\/[a-f0-9-]+/, { timeout: 90000 });
    const match = page.url().match(/\/deals\/([a-f0-9-]+)/);
    const dealId = match?.[1];
    expect(dealId).toBeTruthy();

    await expect(page.getByText(dealName)).toBeVisible();

    if (dealId) {
      await request.delete(`/api/deals/${dealId}`).catch(() => {});
    }
  });

  test('missing-field listing (listing_040) reaches create or rejection screen', async ({
    page,
    request,
  }) => {
    const { hasAuthSession } = await import('../helpers/requireAuth');
    test.skip(!hasAuthSession(), 'Skipped: no auth session.');

    const { listingText } = loadListing('040');
    const dealName = `E2E Missing ${Date.now()}`;

    await page.goto('/deals/new');
    await page.getByTestId('paste-listing').fill(listingText);
    await page.getByTestId('extract-facts').click();

    // Either create-deal submit appears or intake rejection (with "Keep anyway" / "Dismiss")
    await expect(
      page.getByTestId('create-deal-submit').or(page.getByText(/doesn't fit|Keep anyway|reject/i))
    ).toBeVisible({ timeout: 35000 });

    const submitVisible = await page.getByTestId('create-deal-submit').isVisible();
    if (submitVisible) {
      await page.getByTestId('deal-name-input').fill(dealName);
      await page.getByTestId('create-deal-submit').click();
      await expect(page).toHaveURL(/\/deals\/[a-f0-9-]+/, { timeout: 90000 });
      const match = page.url().match(/\/deals\/([a-f0-9-]+)/);
      const dealId = match?.[1];
      if (dealId) await request.delete(`/api/deals/${dealId}`).catch(() => {});
    }
    // If rejection screen: test passes without creating (no cleanup needed)
  });
});
