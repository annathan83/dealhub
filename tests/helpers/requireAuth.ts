import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

/**
 * Returns true if a valid auth session exists (non-empty cookies).
 * Used by fixtures to skip tests immediately when credentials are not configured.
 */
export function hasAuthSession(): boolean {
  try {
    const raw = fs.readFileSync(authFile, 'utf-8');
    const state = JSON.parse(raw) as { cookies?: unknown[] };
    return Array.isArray(state.cookies) && state.cookies.length > 0;
  } catch {
    return false;
  }
}

/**
 * Call inside a test.describe block to skip the entire suite when auth is not set up.
 * Usage:
 *   import { test, expect } from '@playwright/test';
 *   import { requireAuth } from '../helpers/requireAuth';
 *   test.describe('My suite', () => {
 *     requireAuth();
 *     test('...', async ({ page }) => { ... });
 *   });
 */
export function requireAuth() {
  // Import lazily to avoid issues when called outside test context
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { test } = require('@playwright/test') as typeof import('@playwright/test');
  test.beforeEach(() => {
    test.skip(
      !hasAuthSession(),
      'Skipped: no auth session. Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in .env.local and re-run.',
    );
  });
}
