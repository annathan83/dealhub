# DealHub — Finalized Test Plan

**Version:** 1.0  
**Last updated:** 2026-03-11  
**Owner:** Test Manager

---

## 1. Scope

| Area | Description |
|------|-------------|
| **Smoke** | Public pages (landing, signin, signup); no auth. |
| **E2E (chromium)** | Authenticated flows: create deal (manual), upload workflow, dashboard auth. |
| **Test-data E2E** | test-data/–driven: listing extraction, multi-file deal, NDA, broker contact, search by broker, intake rejection. |
| **Slow / AI** | HVAC golden scenario (explicit project). |
| **Screenshots** | UX screenshot flows (explicit project). |

---

## 2. Test Projects & Commands

| Project | Command | Auth | Notes |
|---------|---------|------|--------|
| **setup** | (runs first when needed) | Yes | Writes `playwright/.auth/user.json`. |
| **smoke** | `npx playwright test --project=smoke` | No | Fast; no credentials. |
| **chromium** | `npx playwright test --project=chromium` | Yes | Core E2E. |
| **test-data** | `npx playwright test --project=test-data` | Yes | Uses `test-data/`; listings, multi-file, NDA, broker, intake. |
| **slow** | `npx playwright test --project=slow` | Yes | HVAC golden; AI-heavy. |
| **screenshots** | `npx playwright test --project=screenshots` | Yes | UX screenshots. |
| **Full suite** | `npx playwright test` | Mixed | All projects. |

**Prerequisites for authenticated projects:**  
Set in `.env.local`: `PLAYWRIGHT_TEST_EMAIL`, `PLAYWRIGHT_TEST_PASSWORD`.

---

## 3. Test Data

- **Location:** `test-data/` (listings, broker-emails, financials, nda, multi-file-deals, pdf-extractions).
- **Fixtures:** `dealFromListing` (listing_010), `dealFromMultiFile` (deal-001); teardown deletes created deals.
- **Helpers:** `tests/helpers/testData.ts` — `loadListing(id)`, `loadMultiFileDeal(id)`, `loadNda(id)`.

---

## 4. In-Scope Components / Flows

| # | Component / Flow | Spec(s) | Type |
|---|------------------|--------|------|
| 1 | Landing, signin, signup | smoke/landing, smoke/auth-pages | Smoke |
| 2 | Dashboard (authenticated) | e2e/dashboard-auth | E2E |
| 3 | Create deal (manual entry) | e2e/create-deal | E2E |
| 4 | Upload / note workflow | e2e/upload-workflow | E2E |
| 5 | Listing extraction (clean, semi-structured, missing-field) | e2e/test-data-listing-extraction | Test-data |
| 6 | Multi-file deal creation & facts | e2e/test-data-multi-file | Test-data |
| 7 | NDA load (signed/unsigned) | e2e/test-data-nda | Test-data |
| 8 | Broker contact & search placeholder | e2e/test-data-broker | Test-data |
| 9 | Search by broker / deal name | e2e/test-data-search-broker | Test-data |
| 10 | Intake rejection flow | e2e/test-data-intake-rejection | Test-data |
| 11 | Facts & Analysis tabs | e2e/facts-analysis-tabs | E2E |
| 12 | HVAC golden scenario | scenarios/hvac-golden | Slow |
| 13 | UX screenshots | smoke/ux-screenshots, e2e/ux-screenshots | Screenshots |

---

## 5. Execution Order (Recommended)

1. **Setup:** Ensure `.env.local` has test credentials; run auth setup once.
2. **Smoke:** `npx playwright test --project=smoke`
3. **Chromium E2E:** `npx playwright test --project=chromium`
4. **Test-data E2E:** `npx playwright test --project=test-data`
5. **Slow (optional):** `npx playwright test --project=slow`
6. **Screenshots (optional):** `npx playwright test --project=screenshots`

---

## 6. Success Criteria

- All tests in the chosen project(s) pass (or are skipped with a documented reason).
- No regressions in smoke or core E2E.
- Test-data specs create/teardown deals without leaving orphan data when run in full.

---

## 7. Sign-off

- [ ] Test plan reviewed and approved.
- [ ] **Advance to execution** (see test report folder for post-execution steps and cleanup).

---

## 8. Advance to Execution

**Test plan is finalized.**  

When you are ready to run the suite:

1. Run the projects in the order in §5 (e.g. smoke → chromium → test-data).
2. Record results and any failures in the timestamped report under `test-reports/YYYY-MM-DD_HHMMSS/TEST-REPORT.md`.
3. After execution, **delete all test data from the system** (deals created by tests; see report §6).
4. Fill the report: components tested, bug counts (High / Medium / Low), whether all bugs were solved, and solutions applied (without design change).
5. Store the final summary in the same timestamped folder (this report).

**Proceed to execution?** Confirm when you want to advance.
