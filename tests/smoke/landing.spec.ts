import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('loads and shows main content', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /the workspace for acquisition deals/i })).toBeVisible();
  });

  test('Start a deal CTA navigates to signup', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('landing-start-deal').first().click();
    await expect(page).toHaveURL('/signup');
    await expect(page.getByTestId('signup-form')).toBeVisible();
  });

  test('Sign in CTA navigates to signin', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('landing-signin').first().click();
    await expect(page).toHaveURL('/signin');
    await expect(page.getByTestId('signin-form')).toBeVisible();
  });
});
