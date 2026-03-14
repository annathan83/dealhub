# Prompt 2: Align Scoring Metrics & Facts Tab

## Context
The scored metrics, core facts, and Facts tab need to match the agreed data model exactly. Currently there are mismatches: "Revenue / Employee" should be "SDE / Employee", "Revenue Quality" shouldn't exist, and the scoring weights UI should be removed for v1.

## Changes Required

### 1. Fix the 6 Scored Metrics (everywhere they appear)

Remove any metrics not in this list. Add any that are missing.

| # | Metric | Formula | Inputs Needed |
|---|--------|---------|---------------|
| 1 | Purchase Multiple | Asking Price ÷ SDE | Asking Price, SDE |
| 2 | SDE Margin | SDE ÷ Revenue | SDE, Revenue |
| 3 | SDE / Employee | SDE ÷ Employees (FT) | SDE, Employees |
| 4 | Rent Ratio | (Monthly Rent × 12) ÷ Revenue | Monthly Rent, Revenue |
| 5 | Business Age | Current Year − Year Established | Year Established |
| 6 | Owner Dependence | Mapped from Owner Involvement | Owner Involvement |

**Specifically:**
- Rename "Revenue / Employee" → "SDE / Employee" with formula "SDE ÷ FT" (not "Revenue ÷ FT")
- Remove "Revenue Quality" entirely — it does not exist in our model
- Verify all 6 are present on: Facts tab metrics section, Analysis tab metric breakdown, Scoring settings, deal header summary, preview screen

### 2. Fix the 7 Core Input Facts

| # | Label | Type |
|---|-------|------|
| 1 | Asking Price | currency |
| 2 | Revenue | currency |
| 3 | SDE | currency |
| 4 | Employees (FT) | number |
| 5 | Monthly Rent | currency |
| 6 | Year Established | year |
| 7 | Owner Involvement | text: Absentee / Semi-absentee / Part-time / Full-time |

These are the ONLY facts shown in the "Core Facts" section on the Facts tab. Everything else goes in "Other Extracted Facts."

### 3. Fix the 2 Deal Context Facts

| Label | Type |
|-------|------|
| Industry | text |
| Location | text |

These appear as a compact 2-column block above Core Facts on the Facts tab. They are NOT scored. They feed into Buyer Fit only.

### 4. Facts Tab Layout (top to bottom)

1. Header: "Facts" + "{n} extracted from documents" + Score badge
2. Deal Context block: Industry | Location (compact, 2-column)
3. "CORE FACTS" section label + "{n}/7 sourced" counter
4. 7 core input fact rows
5. "METRICS" section label
6. 6 metric rows — each showing label, formula, colored value, AND source links to input facts below
7. "Other Extracted Facts ({n})" — collapsible, collapsed by default

### 5. Metric Row Source Links

Every metric row must show which input facts feed it. Below the metric name/value line, show small tappable links:

- Purchase Multiple → `📄 Asking Price` `📄 SDE`
- SDE Margin → `📄 SDE` `📄 Revenue`
- SDE / Employee → `📄 SDE` `📄 Employees (FT)`
- Rent Ratio → `📄 Monthly Rent` `📄 Revenue`
- Business Age → `📄 Year Established`
- Owner Dependence → `📄 Owner Involvement`

Links are blue (#3b82f6) if the input has a source document, grey if no source. Tapping opens the document viewer at the evidence passage.

### 6. Scoring Thresholds

| Metric | Green (9-10) | Amber (6-7) | Red (3-4) |
|--------|--------------|-------------|-----------|
| Purchase Multiple | ≤ 3x | 3–4x | > 4x |
| SDE Margin | ≥ 25% | 15–25% | < 15% |
| SDE / Employee | ≥ $60K | $40–60K | < $40K |
| Rent Ratio | ≤ 5% | 5–15% | > 15% |
| Business Age | ≥ 10yr | 5–10yr | < 5yr |
| Owner Dependence | Absentee | Semi-absentee / Part-time | Full-time |

### 7. Score Calculation

- Each metric scores 0–10 individually based on where the value falls within thresholds
- Deal Score = simple average of available metric scores
- Missing metrics are EXCLUDED from the average, not counted as 0
- If 0 metrics available: score is null, display "—"
- Score labels: Strong ≥ 8, Partial ≥ 6, Weak < 6

### 8. Remove Scoring Weights UI

Delete the Scoring Weights settings page (`/settings/scoring`). All metrics are weighted equally (simple average). No user-configurable weights in v1. Remove the weights section from the Buyer Profile page too if it appears there. Remove the "Scoring" sub-nav item from Settings.

### 9. Fact Row Design (unchanged, verify implementation)

- Two states only: has value (white bg, grey left border) or missing (red tint bg, red left border, italic "Not found")
- NO "verified" / "AI extracted" / "manual" badges or status indicators
- Source link on right: blue doc icon + document name + page number if source exists, "—" if not
- Entire row tappable if source exists → opens document viewer
