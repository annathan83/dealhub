# Prompt 3: Workspace Tab — Header, Actions, Timeline & Notes

## Context
The Workspace tab is the operational backbone of a deal. It needs to be tighter and support the full intake lifecycle: upload files, add notes (which includes pasting text), capture photos/audio, and generate AI summaries. The deal header above the tabs also needs slimming.

## 1. Slim Down the Deal Header

**Problem:** The header section above the tabs takes nearly half the screen. Deal name, status bar, NDA badge, Buyer Fit badge, industry, location, date, broker contact CTA, the SDE/ASK/Multiple/Score summary bar, AND four large action buttons — too much chrome before any tab content.

**Changes:**
- Merge the SDE / ASK / Multiple / Score summary into a single compact row within the header card itself — not as a separate card below it
- The status bar (Active / Closed / Passed) + badges (NDA, Buyer Fit) + Industry + Location + Date can stay on one or two lines — they're useful context
- Move the "+ Add broker contact" inside the deal header as a small inline link, not a full-width dashed box
- Move the action buttons (Upload, Note, Photo, Audio) BELOW the tab bar, inside the active tab content — they're workspace actions, not deal-level actions. They should only show on the Workspace tab.

**Result:** The header shows: deal name, status, key badges, and the compact summary numbers. Everything else lives inside the tabs.

## 2. Simplify Action Buttons

**Current:** Four equally-sized card buttons: Upload, Note, Photo, Audio.

**Change:**
- **Upload** and **Note** are the primary actions — make them prominent
- **Photo** and **Audio** are secondary — collapse into a smaller row or "More" overflow
- Layout: two primary buttons side by side (Upload | Note), then smaller text links or icons for Photo and Audio below
- Note action = freeform text input. This covers BOTH typing notes ("Called broker, owner flexible on price") AND pasting text (broker email body, listing updates). No separate "paste" action needed.

## 3. Note = Paste Text (add processing flow)

**Current state:** No documented flow for adding a note to an existing deal.

**New flow:**

```
User taps "Note" → text input field appears (modal or inline)
→ User types or pastes text → submits
→ POST /api/deals/:id/notes (new endpoint)
→ API: create entity_file with source_type = "note"
→ Save to Google Drive raw/ as MM-DD-YY_HH-MM_{AI_Title}.txt
→ Extract text (already is text, so file_texts = the note itself)
→ Chunk → run fact extraction
→ Reconcile facts → update score
→ Create timeline event: "Note added — {AI-generated title}"
→ Return to client → timeline updates, facts/score refresh
```

Key points:
- Notes go through the SAME extraction pipeline as uploaded files
- A pasted broker email should extract new facts just like a PDF would
- The note gets an AI-generated title for the Drive filename (e.g. "Broker_Follow_Up_Notes")
- Notes appear in the timeline with their timestamp and title

## 4. Add "Generate Summary" Action

**New feature:** User-triggered AI summary, saved to `summaries/` on Google Drive.

**Location:** Button on the Workspace tab, below the action buttons or at the bottom of the timeline. Label: "Generate AI Summary" with a sparkle/AI icon.

**Flow:**

```
User taps "Generate AI Summary"
→ Loading state: "Generating summary..."
→ POST /api/deals/:id/summary (new endpoint)
→ API: gather all current facts, metrics, score, buyer fit, notes
→ AI generates a comprehensive deal summary
→ Save to Google Drive summaries/ as MM-DD-YY_HH-MM_Deal_Summary.txt
→ Create timeline event: "AI Summary generated"
→ Return summary text to client
→ Timeline updates with new event
```

The summary includes:
- Deal name and context (industry, location)
- All core facts with values
- All 6 metrics with scores
- Deal Score and Buyer Fit
- Key observations (e.g. "SDE margin is healthy but owner is full-time — transition risk")
- What's missing (e.g. "Employees count not available — cannot calculate SDE/Employee")

Each summary is a point-in-time snapshot. Generating a new one after uploading more documents creates a second file in `summaries/` — they accumulate chronologically.

## 5. Timeline Improvements

**The timeline is the deal's story.** Every action creates a timeline entry.

Event types and what they show:

| Event | Icon | Title | Detail |
|-------|------|-------|--------|
| Deal created | + (green) | "Deal created" | "{Deal name} was added to the pipeline" |
| File uploaded | ↑ (blue) | "Document uploaded — {filename}" | "CIM_Overview.pdf · 12 pages · processing..." then updates to "{n} new facts extracted" |
| Note added | ✎ (grey) | "Note added — {AI title}" | Preview of first 2 lines of note text |
| Photo added | 📷 | "Photo added — {AI title}" | Thumbnail if possible |
| Audio added | 🎙 | "Audio added — {AI title}" | Duration, "Transcribing..." then "Transcribed — {n} facts extracted" |
| Score updated | ✓ (colored) | "Score updated — {score}/10" | "Deal score: {score} · confidence {n}% · {n} facts used · triggered by: {source}" |
| Buyer Fit updated | ◎ | "Buyer Fit: {label}" | "{n} of {n} criteria match" |
| AI Summary generated | ✦ | "AI Summary generated" | "Snapshot saved to Google Drive" — tappable to view |
| Status changed | ○ | "Status changed to {Active/Closed/Passed}" | Timestamp |

**Consolidation rule:** If multiple files are uploaded within 60 seconds, consolidate into one timeline event: "3 documents uploaded" with individual filenames listed below. Same for batch fact extraction: "23 facts extracted from 3 uploads."

**Timeline ordering:** Newest first (reverse chronological).

## 6. Onboarding Checklist — Conditional Display

**Current:** "Get the most out of this deal" checklist always shows inside the Google Drive folder section.

**Change:**
- Only show on deals with 0 uploaded files and 0 notes
- Once any file is uploaded or note is added, the checklist disappears permanently for that deal
- The Google Drive folder link remains visible always — just without the checklist content inside it

## 7. Google Drive Folder Section

Always visible at the bottom of the Workspace tab. Shows:
- Folder icon + deal name + external link to Google Drive
- No onboarding content (unless deal is empty, see above)
- The folder contains: `raw/`, `extracted/`, `summaries/`
- File naming: `MM-DD-YY_HH-MM_Original_Name.ext` or `MM-DD-YY_HH-MM_AI_Generated_Title.txt`
