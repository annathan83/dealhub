import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authDir = path.join(__dirname, '../playwright/.auth');
const authFile = path.join(authDir, 'user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL ?? '';
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD ?? '';

  fs.mkdirSync(authDir, { recursive: true });

  if (!email || !password) {
    // Create empty storage state so dependent projects don't fail with ENOENT
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
    setup.skip(true, 'PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD required');
    return;
  }

  await page.goto('/');
  await page.getByTestId('landing-signin').first().click();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByTestId('signin-submit').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

  await page.context().storageState({ path: authFile });
});
