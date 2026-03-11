import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.join(process.cwd(), 'ux-screenshots');

test.describe('UX review screenshots', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('capture landing, signup, signin pages', async ({ page }) => {
    // Step 1: Landing page (authenticated users are redirected to /dashboard — capture that instead)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-landing-page.png'),
      fullPage: true,
    });

    // Step 2: Signup page
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-signup-page.png'),
      fullPage: true,
    });

    // Step 3: Signin page
    await page.goto('/signin');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-signin-page.png'),
      fullPage: true,
    });
  });
});
