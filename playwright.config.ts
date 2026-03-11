import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Load .env.local for test credentials.
 * Required for authenticated tests:
 *   PLAYWRIGHT_TEST_EMAIL  - email of test user
 *   PLAYWRIGHT_TEST_PASSWORD - password of test user
 * See tests/README.md for setup instructions.
 *
 * PLAYWRIGHT_BASE_URL (optional) — point tests at an already-running server.
 *   Set this when the IDE dev server is already running on port 3000:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test ...
 *   Or add it to .env.local: PLAYWRIGHT_BASE_URL=http://localhost:3000
 */
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const isCI = !!process.env.CI;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const useExternalServer = !!process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    // ── Auth setup ──────────────────────────────────────────────────────────
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
      timeout: 60000,
    },

    // ── Smoke: public pages, no auth ────────────────────────────────────────
    {
      name: 'smoke',
      testDir: './tests/smoke',
      testIgnore: ['**/ux-screenshots.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Chromium: all authenticated tests ──────────────────────────────────
    {
      name: 'chromium',
      testIgnore: ['**/smoke/**', '**/*.setup.ts', '**/ux-screenshots.spec.ts', '**/hvac-golden.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'playwright/.auth/user.json'),
      },
      dependencies: ['setup'],
    },

    // ── Screenshots: dedicated project, run explicitly ──────────────────────
    // npx playwright test --project=screenshots
    {
      name: 'screenshots',
      testMatch: ['**/ux-screenshots.spec.ts'],
      timeout: 120000,
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'playwright/.auth/user.json'),
      },
      dependencies: ['setup'],
    },

    // ── Slow: AI-heavy tests, run explicitly ────────────────────────────────
    // npx playwright test --project=slow
    {
      name: 'slow',
      testMatch: ['**/hvac-golden.spec.ts'],
      timeout: 180000,
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'playwright/.auth/user.json'),
      },
      dependencies: ['setup'],
    },

    // ── Cross-browser: only enabled in CI ──────────────────────────────────
    ...(isCI ? [
      {
        name: 'firefox',
        testIgnore: ['**/smoke/**', '**/*.setup.ts', '**/ux-screenshots.spec.ts', '**/hvac-golden.spec.ts'],
        use: {
          ...devices['Desktop Firefox'],
          storageState: path.join(__dirname, 'playwright/.auth/user.json'),
        },
        dependencies: ['setup'],
      },
      {
        name: 'webkit',
        testIgnore: ['**/smoke/**', '**/*.setup.ts', '**/ux-screenshots.spec.ts', '**/hvac-golden.spec.ts'],
        use: {
          ...devices['Desktop Safari'],
          storageState: path.join(__dirname, 'playwright/.auth/user.json'),
        },
        dependencies: ['setup'],
      },
    ] : []),
  ],

  // When PLAYWRIGHT_BASE_URL is set, skip starting a dev server (use the existing one).
  // Otherwise start one — useful in CI where no server is pre-running.
  ...(useExternalServer ? {} : {
    webServer: {
      command: 'npm run dev',
      url: `${BASE_URL}/signin`,
      reuseExistingServer: !isCI,
    },
  }),
});
