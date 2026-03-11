import { test, expect } from '../fixtures';

/**
 * Facts and Analysis tabs: structure and presence assertions.
 * Uses seededDeal fixture (authenticated deal with manual-entry facts).
 * Does not assert exact AI wording.
 */
test.describe('Facts and Analysis tabs', () => {
  test('facts tab loads, shows facts with source UI, analysis tab shows score', async ({
    page,
    seededDeal,
  }) => {
    const { dealId, dealName } = seededDeal;

    await page.goto(`/deals/${dealId}`);
    await expect(page).toHaveURL(new RegExp(`/deals/${dealId}`));
    await expect(page.getByText(dealName)).toBeVisible();

    // ── Facts tab ─────────────────────────────────────────────────────────
    await page.getByTestId('facts-tab-btn').click();
    await expect(page.getByTestId('facts-tab')).toBeVisible({ timeout: 10000 });

    // At least one fact with value
    const factButtons = page.getByTestId('fact-edit-button');
    await expect(factButtons.first()).toBeVisible({ timeout: 5000 });
    expect(await factButtons.count()).toBeGreaterThanOrEqual(1);

    // At least one fact has source/evidence UI; each fact with value shows source badge
    const factSources = page.getByTestId('fact-source');
    await expect(factSources.first()).toBeVisible({ timeout: 5000 });
    const sourceCount = await factSources.count();
    for (let i = 0; i < sourceCount; i++) {
      await expect(factSources.nth(i)).toBeVisible();
    }

    // ── Analysis tab ───────────────────────────────────────────────────────
    await page.getByTestId('analysis-tab-btn').click();
    await expect(page.getByTestId('score-card')).toBeVisible({ timeout: 15000 });

    // Score is numeric and in valid range (0–10)
    const scoreEl = page.getByTestId('overall-score');
    await expect(async () => {
      const text = await scoreEl.textContent();
      const score = parseFloat(text ?? '');
      expect(Number.isFinite(score)).toBeTruthy();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    }).toPass({ timeout: 30000 });
  });
});
