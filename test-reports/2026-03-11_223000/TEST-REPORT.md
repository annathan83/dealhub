# Test Execution Report

**Run id:** 2026-03-11_223000  
**Date:** 2026-03-11  
**Test plan:** `tests/TEST-PLAN.md` v1.0  
**Executed:** Automated run (Playwright); smoke + test-data attempted.

---

## 1. Components / Scopes Tested

| # | Component / flow | Spec(s) | Result (Pass / Fail / Skip) | Notes |
|---|------------------|--------|-----------------------------|--------|
| 1 | Landing, signin, signup | smoke/landing, smoke/auth-pages | **Fail** | 5 tests: `page.goto` net::ERR_ABORTED (timeout 45s). |
| 2 | Dashboard (authenticated) | e2e/dashboard-auth | **Not run** | Depends on auth setup; setup failed (same ERR_ABORTED). |
| 3 | Create deal (manual entry) | e2e/create-deal | **Not run** | Same. |
| 4 | Upload / note workflow | e2e/upload-workflow | **Not run** | Same. |
| 5 | Listing extraction | e2e/test-data-listing-extraction | **Not run** | Same. |
| 6 | Multi-file deal creation & facts | e2e/test-data-multi-file | **Not run** | Same. |
| 7 | NDA load (signed/unsigned) | e2e/test-data-nda | **Not run** | Setup failed; 3 NDA tests did not run. |
| 8 | Broker contact & search | e2e/test-data-broker | **Not run** | Same. |
| 9 | Search by broker | e2e/test-data-search-broker | **Not run** | Same. |
| 10 | Intake rejection flow | e2e/test-data-intake-rejection | **Not run** | Same. |
| 11 | Facts & Analysis tabs | e2e/facts-analysis-tabs | **Not run** | Same. |
| 12 | HVAC golden scenario | scenarios/hvac-golden | **Skip** | Optional; not run. |
| 13 | UX screenshots | smoke/ux-screenshots, e2e/ux-screenshots | **Skip** | Optional; not run. |

**Summary:** 5 smoke tests failed (navigation ERR_ABORTED). Chromium and test-data projects were not run to completion because auth setup failed with the same navigation error. No test-created deals were persisted (tests did not reach teardown).

---

## 2. Bug Summary

| Severity | Count | Resolved | Open |
|----------|-------|----------|------|
| **High** | 0 | 0 | 0 |
| **Medium** | 1 | 0 | 1 |
| **Low** | 1 | 1 | 0 |
| **Total** | 2 | 1 | 1 |

**Severity definitions:**
- **High:** Blocker; critical path broken (e.g. cannot create deal, cannot sign in).
- **Medium:** Major feature impaired; workaround exists.
- **Low:** Minor (cosmetic, edge case, non-blocking).

---

## 3. Bugs (Detail)

| ID | Severity | Component | Description | Resolved (Y/N) | Solution / notes |
|----|----------|-----------|-------------|----------------|-------------------|
| B1 | Low | tests/helpers/testData.ts | `as MultiFileDealExpected` caused SyntaxError in test runner (TS assertion parsed as JS). | **Y** | Use typed variable: `const expected: MultiFileDealExpected = JSON.parse(...)`. |
| B2 | Medium | E2E environment | `page.goto` to localhost:3000 ends with net::ERR_ABORTED; test timeout. Blocks smoke + auth setup + all dependent E2E. | **N** | Likely env: dev server or Next.js in this runner. Run locally with `npm run dev` then `PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test` or investigate CI/server startup. |

---

## 4. Solutions Applied (No Design Change)

| Item | File / area | Change |
|------|-------------|--------|
| 1 | `components/DealsTable.tsx` | `navigator.clipboard.writeText(display ?? dialString ?? "")` to satisfy `string` type (avoid null). |
| 2 | `tests/helpers/testData.ts` | Replaced `as MultiFileDealExpected` with `const expected: MultiFileDealExpected = JSON.parse(...)`. |
| 3 | `tests/smoke/landing.spec.ts`, `tests/smoke/auth-pages.spec.ts` | `page.goto(..., { waitUntil: 'domcontentloaded' })` to reduce load-related aborts (no change in env yet). |
| 4 | `tests/auth.setup.ts` | Same `waitUntil: 'domcontentloaded'` for auth setup goto. |
| 5 | `playwright.config.ts` | `webServer.timeout: 120000` for dev server startup. |

---

## 5. All Bugs Resolved?

- [ ] **Yes** — All reported bugs in this run are resolved.
- [x] **No** — B2 (ERR_ABORTED in test env) remains; resolve by running tests with a stable dev server (e.g. local or CI with proper startup).

---

## 6. Post-Execution: Delete Test Data

**Action required after execution:**

1. **Deals created by tests**  
   - In this run no deals were created (tests failed before creating/teardown). If you run tests again and any run is interrupted, **manually delete** test deals from the app (or via Supabase): look for deals named like `E2E Listing listing_010 …`, `E2E MultiFile deal-001 …`, `E2E Deal …`, etc.

2. **Auth / session**  
   - `playwright/.auth/user.json` is local; no server-side test user cleanup required unless you created a dedicated test user and want to remove it.

3. **Test-data files**  
   - The `test-data/` folder is static files (listings, NDAs, etc.); no need to "delete from system" unless you mean removing that folder from the repo or excluding it from backups.

**Please confirm when done:** [ ] Test data cleaned up from the system.

---

## 7. Next Steps (Evaluate After Run)

- Re-run failed tests after fixes; update this report.
- For open bugs that require design change: create tickets and decide prioritization.
- Archive this folder or copy `TEST-REPORT.md` to a shared location if needed.
