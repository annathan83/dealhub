# Prompt 4: Analysis Tab — Deal Score & Buyer Fit

## Context
The Analysis tab answers "Should I pursue this deal?" through two separate evaluations. The current implementation is close but needs alignment with the agreed metric model and some cleanup.

## 1. Deal Score Section

### Score Header
- Large score number (one decimal, e.g. "7.9") with colored background badge
- Color: green (#16a34a) ≥ 8, amber (#d97706) ≥ 6, red (#dc2626) < 6
- Label next to score: "Strong" / "Partial" / "Weak"
- Subtitle: "Based on {n} of 6 metrics"

### Metric Breakdown Table

Column headers: METRIC | VALUE | TYPICAL RANGE | SCORE

6 rows, one per metric:

| Metric | Typical Range |
|--------|---------------|
| Purchase Multiple | 2.5x–4.0x |
| SDE Margin | 15%–30% |
| SDE / Employee | $50K–$100K |
| Rent Ratio | 5%–15% |
| Business Age | 5–20 years |
| Owner Dependence | Varies |

Each row shows:
- Metric name (11px, semibold)
- Value in monospace (or "—" if unavailable)
- Typical range in grey (static context, not configurable)
- Individual score 0–10, colored green/amber/red (or "—")

**Below each metric row:** small source links showing which input facts feed it. Blue doc icon + label if source exists, grey label if no source. Tappable → switches to Workspace tab and highlights the source file.

Example for Purchase Multiple row:
```
Purchase Multiple    2.34x    2.5x–4.0x    8.0
  📄 Asking Price p.1    📄 SDE p.12
```

**Missing metrics:** show "—" for value and score. Below the table, italic grey text explaining what's missing:
"SDE / Employee needs: Employees (FT)"
"Rent Ratio needs: Monthly Rent, Revenue"

### What to Remove
- No progress bars
- No weight percentages
- No "Strengths" / "Risks" summary section — metric colors communicate this
- No SWOT analysis (if this exists, remove it from the Analysis tab — it's not in our model)

## 2. Buyer Fit Section

### When Buyer Profile Exists

**Fit header:**
- Label badge: "Strong Fit" / "Partial Fit" / "Weak Fit" / "No Fit"
- Badge color: Strong = green bg, Partial = amber bg, Weak/No = red bg
- Subtitle: "Based on your Buyer Profile"

**Criteria match list:** One row per configured criterion:
- ✓ (green check) — criterion matches
- ✗ (red X) — criterion doesn't match  
- — (grey dash) — fact not available, can't evaluate

Each row shows:
- Check/X/dash icon
- Criterion name (e.g. "Price Range")
- Context line (e.g. "$725K is within $500K–$1.5M" or "$725K exceeds max $500K")

Only show criteria the buyer has configured. Skip unconfigured ones.

### When No Buyer Profile Exists

Show empty state:
- Muted card with dashed border
- Title: "Set up your Buyer Profile"
- Description: "Compare this deal against your preferences — price range, industries, locations, and more."
- Single button: "Set Up Profile" → navigates to `/settings/buyer-profile`
- No placeholder criteria rows, no greyed-out matches

## 3. Buyer Fit Criteria (reference)

These are the criteria configured in the Buyer Profile that get matched against extracted facts:

| Criterion | Buyer Profile Field | Matched Against |
|-----------|-------------------|-----------------|
| Price Range | min/max asking price | Asking Price |
| Revenue Range | min/max revenue | Revenue |
| SDE Range | min/max SDE | SDE |
| Target Industries | multi-select | Industry |
| Preferred Locations | multi-select / regions | Location |
| Max Employees | number | Employees (FT) |
| Owner Involvement | select preference | Owner Involvement |
| Max Rent | currency | Monthly Rent |
| Min Business Age | number (years) | Year Established |
| Real Estate Preference | select (Leased/Owned/Either) | Real Estate (from other facts) |
| Financing Requirement | select (SBA eligible, etc.) | Financing (from other facts) |

This list is extensible. Buyer Fit checks ALL extracted facts, not just the 7 core inputs.

## 4. Layout (top to bottom)

1. Deal Score section header: "DEAL SCORE"
2. Score card with header + metric table
3. Spacing
4. Buyer Fit section header: "BUYER FIT"  
5. Buyer Fit card (criteria list OR empty state)

Both sections should fit on one phone screen without scrolling when data is sparse. When the metric table has 6 rows and buyer fit has 8+ criteria, scrolling is fine.
