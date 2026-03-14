# DealHub — Cursor Prompt Index

5 focused prompts, ordered by priority. Each is self-contained — feed them to Cursor one at a time.

## Execution Order

### Ship first (closes the biggest gaps)

**Prompt 1 — Deal Creation Preview with Scoring**
`prompt-01-deal-creation-preview.md`
Redesigns the paste-first creation flow. The preview screen shows Deal Score, Buyer Fit, and all extracted facts BEFORE the deal is created. Replaces the post-creation intake rejection screen. This is the most impactful change — it delivers the "2-minute triage" promise on the very first interaction.

**Prompt 2 — Scoring & Facts Alignment**
`prompt-02-scoring-facts-alignment.md`
Fixes the 6 scored metrics (removes Revenue Quality, renames Revenue/Employee to SDE/Employee), aligns the 7 core inputs, ensures source links appear on every metric row. Pure alignment work — the data model is right, the UI just needs to match.

### Ship second (workspace improvements)

**Prompt 3 — Workspace Tab**
`prompt-03-workspace-tab.md`
Slims the deal header, simplifies action buttons (Upload + Note primary, Photo/Audio secondary), adds the Note processing flow (notes trigger fact extraction like files do), adds "Generate AI Summary" button, improves timeline event types, kills the onboarding checklist on populated deals.

### Ship third (polish)

**Prompt 4 — Analysis Tab**
`prompt-04-analysis-tab.md`
Aligns the Analysis tab with the agreed model. Deal Score with 6 metrics, typical ranges, source links. Buyer Fit with criteria matching. Removes any SWOT or Strengths/Risks sections. Mostly already correct — this is cleanup.

**Prompt 5 — Settings & Manual Entry**
`prompt-05-settings-cleanup.md`
Removes the Scoring Weights page entirely. Simplifies manual entry form to 3 required fields + expandable details. Cleans up the Buyer Profile page. Settings nav goes from 3 items to 2.

## Cross-cutting decisions (apply to all prompts)

- **No scoring weights** — all 6 metrics weighted equally, simple average
- **No "verified/AI/manual" status** — facts have evidence links or they don't
- **Missing data never penalizes score** — excluded from average
- **Note = paste text** — same input field, same processing pipeline
- **Google Drive folders:** raw/ extracted/ summaries/ per deal
- **File naming:** MM-DD-YY_HH-MM_Name.ext
- **AI summaries are user-triggered**, not automatic
