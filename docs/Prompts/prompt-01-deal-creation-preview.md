# Prompt 1: Redesign Deal Creation — Preview with Scoring

## Context
The deal creation flow needs to show the user a full triage preview BEFORE the deal is created. Currently, Flow 14 calls `/api/deals/pre-extract` and shows extracted fields, then Flow 3 creates the deal and potentially shows an intake rejection screen after creation. These need to merge: the preview step replaces the post-creation rejection screen entirely.

## Current Flow (what exists)
1. User pastes text → clicks "Extract Facts with AI"
2. `POST /api/deals/pre-extract` → AI extracts facts
3. Client shows extracted fields, user edits
4. User submits → `POST /api/deals` creates deal + entity
5. API runs inference + KPI scoring
6. If verdict = PROBABLY_PASS → rejection screen (deal already exists with `intake_status = pending`)
7. User rejects or keeps

## New Flow (what to build)
1. User pastes text (and optionally attaches files) → clicks "Extract Facts with AI"
2. `POST /api/deals/pre-extract` → AI extracts facts, calculates metrics, scores the deal, evaluates buyer fit
3. Client shows the **preview screen** (see layout below)
4. User reviews score, edits deal name if needed
5. User clicks "Create Deal" → `POST /api/deals` with all pre-extracted data
6. Deal is created with `intake_status = promoted` — no pending state needed
7. User clicks "Discard" → nothing is created, return to Deal Flow page

The key change: **no deal record exists until the user confirms.** The preview is ephemeral. The intake rejection screen (Flow 7) is no longer needed as a separate flow — the preview IS the rejection/acceptance moment.

## Preview Screen Layout

Top to bottom:

### Deal Name
- Editable text field
- Pre-filled with AI suggestion, e.g. "Home Improvement — Palm Beach County, FL"

### Deal Context
- Compact two-column block: Industry | Location
- Same styling as the Facts tab context block
- Shows "Not found" in grey italic if AI couldn't extract

### Deal Score Badge
- Large score display: number (0-10, one decimal) with colored background
- Label: Strong (≥8) / Partial (≥6) / Weak (<6)
- Subtitle: "Based on {n} of 6 metrics"
- If too sparse to score: show "—" with "Not enough data to score"

### Metric Breakdown
- Compact list of 6 metrics
- Each shows: metric name, value (or "—"), color (green/amber/red/grey)
- No typical range or individual scores needed here — keep it tight
- Metrics: Purchase Multiple, SDE Margin, SDE/Employee, Rent Ratio, Business Age, Owner Dependence

### Core Facts Found
- The 7 inputs as compact rows
- Same styling as Facts tab: label → value, red tint if missing
- Source links not shown here (no documents yet, just pasted text)
- Count summary: "5 of 7 core facts found"

### Buyer Fit (conditional)
- ONLY show if buyer profile exists
- Label badge: Strong Fit / Partial Fit / Weak Fit / No Fit
- One-line summary: "4 of 5 criteria match" or "Price exceeds your range"
- If no buyer profile: don't show this section at all (not even an empty state)

### Actions
- **"Create Deal"** — primary button, green. Creates the deal, redirects to `/deals/:id?tab=workspace`
- **"Discard"** — secondary, text-only. Returns to Deal Flow. Nothing saved.

### File Attachments (optional)
- Below the paste field (before extraction), keep the drag-and-drop file zone
- If files are attached, they get processed during pre-extract too
- Preview shows facts from BOTH pasted text and attached files

## API Changes

### `POST /api/deals/pre-extract` — update response
Current: returns extracted fields only.
New: returns extracted fields + calculated metrics + deal score + buyer fit label.

Response shape:
```ts
{
  suggestedName: string,
  context: { industry: string | null, location: string | null },
  coreFacts: Array<{ label: string, value: string | null }>,
  metrics: Array<{
    label: string,
    formula: string,
    value: string | null,
    score: number | null,  // 0-10
    status: "good" | "ok" | "bad" | "missing"
  }>,
  dealScore: number | null,  // 0-10 average
  dealScoreLabel: "Strong" | "Partial" | "Weak" | null,
  metricsAvailable: number,  // how many of 6 could be calculated
  buyerFit: {  // null if no buyer profile
    label: "Strong Fit" | "Partial Fit" | "Weak Fit" | "No Fit",
    matchCount: number,
    totalCriteria: number,
    summary: string  // e.g. "Price exceeds your range"
  } | null,
  otherFacts: Array<{ label: string, value: string | null }>,
  rawText: string  // the original pasted text, preserved
}
```

### `POST /api/deals` — simplify
Remove the intake verdict logic. The deal is always created as `intake_status = promoted` because the user already made their decision in the preview. Remove the PROBABLY_PASS path.

## What to Remove
- The intake rejection screen (Flow 7) — no longer needed
- The `intake_status = pending` state — deals are either promoted or don't exist
- The `intake_rejections` table entries for new deals — the discard action from preview doesn't create any record
- The "Minimum needed: industry, location, asking price, SDE" footer text on the create page — the preview shows what's missing

## Manual Entry Mode
Keep the manual entry form as an alternative tab on the create page. But simplify it:
- Required fields: Deal Name, Asking Price, SDE only
- Everything else (source, category, industry, state, county, city) hidden behind "Add more details" expandable section
- After submit: same preview screen but with manually entered data
- Score calculated from whatever was provided
