import { test, expect } from '@playwright/test';

test.describe('Auth pages', () => {
  test('signup page loads with form', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL('/signup');
    await expect(page.getByTestId('signup-form')).toBeVisible();
    await expect(page.getByTestId('signup-submit')).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
  });

  test('signin page loads with form', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL('/signin');
    await expect(page.getByTestId('signin-form')).toBeVisible();
    await expect(page.getByTestId('signin-submit')).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
  });
});
