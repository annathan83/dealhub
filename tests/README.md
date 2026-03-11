# Playwright Tests

## Running Tests

```bash
# Smoke tests only (no auth required)
npx playwright test --project=smoke

# E2E and scenario tests (requires auth)
npx playwright test --project=chromium

# Full suite
npx playwright test
```

## Environment Variables for Local Test Auth

Authenticated tests (e2e, scenarios, dashboard) require a test user. Add these to `.env.local`:

| Variable | Description |
|----------|-------------|
| `PLAYWRIGHT_TEST_EMAIL` | Email of the test user |
| `PLAYWRIGHT_TEST_PASSWORD` | Password of the test user |

**Example `.env.local`:**

```
PLAYWRIGHT_TEST_EMAIL=test@example.com
PLAYWRIGHT_TEST_PASSWORD=your-test-password
```

The setup project runs first, signs in once, and saves the session to `playwright/.auth/user.json`. All authenticated projects (chromium, firefox, webkit) reuse that storage state.

**Note:** `.env.local` and `playwright/.auth/` are gitignored. Do not commit credentials.

## UX Review Screenshots

Screenshots are saved to `ux-screenshots/` at project root.

```bash
# Public pages only (no auth)
npx playwright test tests/smoke/ux-screenshots.spec.ts --project=smoke

# All flows (requires auth)
npx playwright test tests/e2e/ux-screenshots.spec.ts --project=chromium
```

**All flows:** landing, signup, signin, dashboard, create deal (paste + manual), deal page (Workspace, Facts, Analysis tabs).
