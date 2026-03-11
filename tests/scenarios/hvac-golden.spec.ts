import { test, expect } from '../fixtures';

/**
 * HVAC golden scenario — @slow
 * Calls the real OpenAI extraction API. Run explicitly:
 *   npx playwright test --project=slow
 *
 * Validates deal page structure and presence only — no exact AI text.
 */
test.describe('HVAC golden scenario @slow', () => {
  test('deal page loads, facts show expected labels, analysis visible, score in range', async ({
    page,
    hvacCleanDeal,
  }) => {
    const { dealId, dealName, expected } = hvacCleanDeal;

    await page.goto(`/deals/${dealId}`);
    await expect(page).toHaveURL(new RegExp(`/deals/${dealId}`));
    await expect(page.getByText(dealName)).toBeVisible();

    // Facts tab: expected fact labels present
    await page.getByTestId('facts-tab-btn').click();
    await expect(page.getByTestId('facts-tab')).toBeVisible({ timeout: 10000 });

    for (const { label } of expected.expectedFacts) {
      await expect(page.getByText(new RegExp(label, 'i')).first()).toBeVisible({ timeout: 5000 });
    }

    // Analysis tab: visible, score in range
    await page.getByTestId('analysis-tab-btn').click();
    await expect(page.getByTestId('score-card')).toBeVisible({ timeout: 15000 });

    const scoreEl = page.getByTestId('overall-score');
    await expect(scoreEl).toBeVisible({ timeout: 15000 });
    await expect(async () => {
      const scoreText = await scoreEl.textContent();
      const score = parseFloat(scoreText ?? '');
      expect(score).toBeGreaterThanOrEqual(expected.expectedScoreRange.min);
      expect(score).toBeLessThanOrEqual(expected.expectedScoreRange.max);
    }).toPass({ timeout: 60000 });
  });
});
