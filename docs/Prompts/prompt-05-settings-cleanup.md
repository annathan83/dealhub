# Prompt 5: Settings Cleanup & Manual Entry Simplification

## Context
The Settings pages and manual entry form need alignment with the agreed model. The scoring weights page should be removed, and the manual entry form is too complex.

## 1. Remove Scoring Weights Page

**Delete entirely:** `/settings/scoring` page and the "Scoring" sub-nav item.

All metrics are weighted equally (simple average of available scores). No user-configurable weights in v1.

If the Buyer Profile page (`/settings/buyer-profile`) also has a "Deal score weights" section at the bottom, remove that section too. The Buyer Profile page should only contain buyer preference fields, not scoring configuration.

**Settings sub-nav after this change:** Integrations | Buyer Profile (only two items).

## 2. Simplify Manual Entry Form

**Current:** 12+ visible fields: Deal Name, Asking Price, SDE/Cash Flow, Source, Source Detail, Category, Industry, State, County, City, Notes, Files.

**Change:**

**Always visible (required):**
- Deal Name (text field, placeholder: "e.g. Midwest HVAC Company — Chicago, IL")
- Asking Price (currency field)
- SDE / Cash Flow (currency field)

**Hidden behind "Add more details" expandable:**
- Revenue
- Employees (FT)
- Monthly Rent
- Year Established
- Owner Involvement (select: Absentee / Semi-absentee / Part-time / Full-time)
- Industry (text or select)
- Location (text: state, county, city as one field, not three separate dropdowns)
- Deal Source (select: Broker / BizBuySell / Axial / Direct / Other) + Source Detail (text)
- Notes (textarea)
- Files (drag-and-drop zone)

**Remove:**
- Separate State / County / City dropdowns — replace with a single Location text field
- Category dropdown — unnecessary, Industry covers this
- "Select category first" / "Select state first" dependent dropdowns — too complex

**Keep:**
- The "Still needed before scoring" banner showing which facts are missing — this is useful
- The file attachment zone at the bottom

**After submit:** Same preview screen as paste mode (Prompt 1) — show extracted/entered facts, Deal Score, metrics, Buyer Fit, then "Create Deal" or "Discard."

## 3. Buyer Profile Page Cleanup

The current Buyer Profile page is good. Keep:
- "Import from Document" feature (upload acquisition criteria doc, AI fills fields)
- Industry Preferences (preferred + excluded)
- Financial Targets (SDE range, purchase price range)
- Location Preferences
- Operational Preferences (max employees, manager in place, owner-operator model)
- Background & Goals (preferred characteristics, experience, acquisition goals)

**Remove** from this page:
- "Deal score weights" section if it appears here — weights are not configurable in v1

## 4. Settings Navigation

Final sub-nav: **Integrations** | **Buyer Profile**

That's it. Two items. Clean.

## 5. Process Flow Update (Flow 8)

Updated settings flow:

```
User opens /settings/* → middleware checks auth
  /settings/integrations → Google Drive connect/disconnect
  /settings/buyer-profile → Buyer Profile form (save: PATCH /api/buyer-profile)
```

No more `/settings/scoring` route.
