# DealHub — Process Flows

Process flows for every major situation in the app. Use these to reason about navigation, API calls, and edge cases.

---

## 1. Request & auth (middleware)

Every request passes through middleware. Auth and route protection happen here.

```mermaid
flowchart TD
  A[Request] --> B{Path protected?<br>/dashboard, /deals, /settings}
  B -->|No| C{Signin or Signup page?}
  B -->|Yes| D{User logged in?}
  D -->|No| E[Redirect to /signin]
  D -->|Yes| F[Allow request]
  C -->|Yes| G{User logged in?}
  C -->|No| F
  G -->|Yes| H[Redirect to /dashboard]
  G -->|No| F
```

**Outcomes**

| Situation | Result |
|-----------|--------|
| Protected route, no user | → `/signin` |
| Protected route, user | → Page loads |
| `/signin` or `/signup`, user | → `/dashboard` |
| `/signin` or `/signup`, no user | → Auth page loads |
| `/`, other public | → Page loads |

---

## 2. Sign in & sign up

**Sign in**

```mermaid
flowchart LR
  A[Sign in page] --> B[User submits email/password]
  B --> C[Supabase signIn redirectTo /auth/callback]
  C --> D[Auth callback]
  D --> E{Code exchange OK?}
  E -->|No| F[Redirect /signin?error=auth_callback_failed]
  E -->|Yes| G{next === /dashboard<br>and no Google token?}
  G -->|Yes| H[Redirect /settings/integrations]
  G -->|No| I[Redirect to next or /dashboard]
```

**Sign up**

- Same redirect: Supabase → `/auth/callback` → then same logic as sign-in (integrations if first time, else `next` or dashboard).

---

## 3. Deal creation

Create deal can be **paste** (paste listing → extract facts) or **manual** (form only). Both submit to `POST /api/deals`.

```mermaid
flowchart TD
  A[Create deal form] --> B[Submit: POST /api/deals]
  B --> C[API: create deal + entity]
  C --> D[Seed manual/extracted facts]
  D --> E[Run inference + KPI scoring]
  E --> F{Intake verdict}
  F -->|PROBABLY_PASS| G[Set intake_status = pending]
  F -->|Other or error| H[Set intake_status = promoted]
  G --> I[Return intake_verdict + dealId to client]
  H --> J[Return dealId to client]
  I --> K[Client: show intake rejection screen]
  J --> L[Client: upload files + notes then redirect to /deals/:id?tab=analysis]
  K --> M{User action}
  M -->|Reject| N[POST intake-reject action=reject]
  M -->|Keep anyway| O[POST intake-reject action=keep]
  N --> P[Deal intake_status = rejected]
  O --> Q[Deal intake_status = promoted]
  P --> R[User stays or goes to dashboard]
  Q --> S[Redirect to /deals/:id?tab=analysis]
```

**Situations**

| Situation | What happens |
|-----------|----------------|
| Verdict ≠ PROBABLY_PASS | Deal promoted, client uploads files/notes, then redirect to deal Analysis tab. |
| Verdict = PROBABLY_PASS | Rejection screen; files already uploaded. User **Reject** → deal rejected; **Keep anyway** → promoted, redirect to deal. |
| API/network error | Error state on form, no redirect. |
| Pipeline failure in API | Deal is promoted so it does not stay pending. |

---

## 4. Deal page load

```mermaid
flowchart TD
  A[GET /deals/:id] --> B{Middleware: user?}
  B -->|No| C[Redirect /signin]
  B -->|Yes| D[buildDealPageViewModel]
  D --> E{VM built?}
  E -->|No| F[notFound 404]
  E -->|Yes| G{deal.intake_status}
  G -->|rejected| H[Redirect /dashboard]
  G -->|pending or promoted or null| I[Load page: header, tabs, data]
  I --> J[Optional ?tab= workspace|facts|analysis]
```

**Situations**

| Situation | Result |
|-----------|--------|
| Not logged in | → `/signin` (middleware). |
| Deal missing / VM fails | → 404. |
| Deal rejected | → Redirect to dashboard. |
| Deal exists, not rejected | → Deal page; tab from query or default. |

---

## 5. Deal page — tabs & “View source”

```mermaid
flowchart TD
  A[Deal page] --> B[Active tab: Workspace | Facts | Analysis]
  B --> C{User action}
  C -->|Click another tab| D[Set activeTab, render that tab]
  C -->|Click source link in Facts/Analysis| E[onViewSourceInWorkspace fileId]
  E --> F[setHighlightFileId, setActiveTab = workspace]
  F --> G[Workspace tab: IntakeSection receives highlightFileId]
  G --> H[Select file, open detail modal if needed]
```

**Situations**

| Situation | Result |
|-----------|--------|
| Switch tab | Content switches to Workspace / Facts / Analysis. |
| “View source” on a fact or metric | Switch to Workspace, file highlighted/selected and modal opened if used. |

---

## 6. File upload (on a deal)

User uploads files from the deal’s Workspace (or during create flow).

```mermaid
flowchart TD
  A[User selects files] --> B[POST /api/deals/:id/files]
  B --> C{Validate: size, type}
  C -->|Invalid| D[4xx + message]
  C -->|Valid| E[Upload to Drive or Supabase storage]
  E --> F[Create entity_file]
  F --> G[Extract text]
  G --> H[Store file_texts, chunks]
  H --> I[Run fact extraction]
  I --> J[Reconcile facts → entity_fact_values]
  J --> K[Sync broker contacts from facts → deal_contacts]
  K --> L[Sync primary contact → deals.broker_*]
  L --> M[Post-fact pipeline: score, SWOT, missing info]
  M --> N[200 + file metadata]
```

**Situations**

| Situation | Result |
|-----------|--------|
| File too large / wrong type | Validation error, no upload. |
| Drive error | Fallback to Supabase storage when implemented; else error. |
| Extract / pipeline error | Often non-fatal; file and text stored, later steps may be partial or retried. |

---

## 7. Intake rejection — Reject vs Keep

Shown only when create deal returns `intake_verdict === "PROBABLY_PASS"`.

```mermaid
flowchart TD
  A[Rejection screen] --> B{User choice}
  B -->|Reject| C[POST /api/deals/:id/intake-reject<br>action: reject]
  B -->|Keep anyway| D[POST /api/deals/:id/intake-reject<br>action: keep]
  C --> E[DB: intake_status = rejected]
  E --> F[Audit log, optional Drive cleanup]
  F --> G[Client: may navigate to dashboard or stay]
  D --> H[DB: intake_status = promoted]
  H --> I[Redirect /deals/:id?tab=analysis]
```

---

## 8. Settings pages

All under `/settings/*`; require auth (middleware). Sub-nav: Integrations, Buyer Profile (two items only).

```mermaid
flowchart TD
  A[User opens /settings/*] --> B{Middleware: user?}
  B -->|No| C[Redirect /signin]
  B -->|Yes| D{Which page?}
  D -->|/settings/integrations| E[Integrations: Drive connect, OAuth callback]
  D -->|/settings/buyer-profile| F[Buyer Profile form]
  E --> H[Connect: GET /api/google/connect → Google OAuth]
  H --> I[Callback: /api/drive/oauth-callback]
  I --> J[Tokens saved, redirect returnTo or /settings/integrations]
  F --> K[Save profile: PATCH /api/buyer-profile]
```

**Situations**

| Situation | Result |
|-----------|--------|
| Not logged in | → `/signin`. |
| Integrations — Connect Google | OAuth → callback → tokens stored, redirect back. |
| Integrations — OAuth error | Redirect to `/settings/integrations?error=...`. |
| Buyer profile — Save | PATCH to API; success/error in UI. |

---

## 9. Google Drive OAuth callback

Used when connecting Drive from Settings.

```mermaid
flowchart TD
  A[Google redirects to /api/drive/oauth-callback] --> B{code + no error?}
  B -->|No| C[Redirect /settings/integrations?error=google_auth_failed]
  B -->|Yes| D[User from Supabase session]
  D --> E{User?}
  E -->|No| F[Redirect /signin]
  E -->|Yes| G[Exchange code for tokens]
  G --> H{Success?}
  H -->|No| I[Redirect integrations?error=...]
  H -->|Yes| J[Store tokens, redirect returnTo or /settings/integrations]
```

---

## 10. Buyer profile (settings)

```mermaid
flowchart TD
  A[Settings: Buyer Profile page] --> B[Buyer Profile form]
  B --> C[Save: PATCH /api/buyer-profile]
  C --> D[DB: buyer_profiles]
```

---

## 11. Dashboard — deal list & empty states

```mermaid
flowchart TD
  A[GET /dashboard] --> B{User?}
  B -->|No| C[Redirect /signin]
  B -->|Yes| D[Fetch deals: intake_status null or promoted or pending]
  D --> E{Deals count}
  E -->|0| F[Empty state: connect Drive, create deal]
  E -->|>0| G[Table: deals, link to /deals/:id]
  G --> H{Click row}
  H --> I[Navigate to /deals/:id]
```

Rejected deals are excluded from the list. Pending deals are shown (e.g. “New” or similar).

---

## 12. Deal not found & rejected access

```mermaid
flowchart TD
  A[Request /deals/:id] --> B[buildDealPageViewModel]
  B --> C{Result}
  C -->|Error / no deal| D[notFound 404]
  C -->|Success| E{intake_status}
  E -->|rejected| F[Redirect /dashboard]
  E -->|other| G[Render deal page]
```

---

## 13. View source from Facts or Analysis

```mermaid
flowchart TD
  A[Facts or Analysis tab] --> B[User clicks source link on fact/metric]
  B --> C[onViewSourceInWorkspace fileId]
  C --> D[setHighlightFileId fileId]
  D --> E[setActiveTab workspace]
  E --> F[Deal page re-renders Workspace]
  F --> G[IntakeSection gets highlightFileId]
  G --> H[useEffect: find file, set selected, open modal]
  H --> I[User sees file detail / content]
```

---

## 14. Create deal — paste mode with extraction

```mermaid
flowchart TD
  A[Paste listing text] --> B[Click Extract facts]
  B --> C[POST /api/deals/pre-extract]
  C --> D[AI extracts facts]
  D --> E[Client: show extracted fields, enable Submit]
  E --> F[User may edit, then Submit]
  F --> G[POST /api/deals with extracted_facts]
  G --> H[Same flow as main deal creation]
```

---

## 15. NDA state (deal)

NDA is tracked separately from intake; deal page can show NDA signed / review / pending based on NDA detection and user actions (no separate flow here; state is read from deal/entity and displayed).

---

## Summary table — “Where do I end up?”

| From | Condition | To |
|------|-----------|----|
| Any protected URL | Not logged in | `/signin` |
| `/signin`, `/signup` | Logged in | `/dashboard` |
| `/auth/callback` | Success, first time (no Drive token) | `/settings/integrations` |
| `/auth/callback` | Success, has Drive token or next set | `next` or `/dashboard` |
| Create deal submit | Verdict ≠ PROBABLY_PASS | `/deals/:id?tab=analysis` |
| Create deal submit | Verdict = PROBABLY_PASS | Rejection screen → Reject (deal rejected) or Keep → `/deals/:id?tab=analysis` |
| `/deals/:id` | Deal rejected | `/dashboard` |
| `/deals/:id` | Deal not found | 404 |
| Facts/Analysis “View source” | Click link | Workspace tab, file highlighted |
| Settings (any) | Not logged in | `/signin` |

All flows assume middleware runs first; then page or API handler runs with the current user (or redirect).
