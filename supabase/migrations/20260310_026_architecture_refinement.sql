-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 026: Architecture Refinement
--
-- Summary of changes (all additive / non-breaking):
--
-- 1. file_text → rename to file_texts, add text_type for multi-version support,
--    drop the UNIQUE(file_id) constraint so multiple text records per file are allowed.
--    Old single-row usage continues to work; new code can add typed variants.
--
-- 2. file_chunks → add file_text_id FK so chunks reference a specific text record.
--    file_id is kept for backward compatibility. New chunks should set file_text_id.
--
-- 3. fact_definitions → add fact_scope, display_order (top-level), is_user_visible_initially,
--    is_required_for_kpi, industry_key for stage-aware and industry-aware workflows.
--
-- 4. entity_fact_values → replace manual_override bool with richer
--    value_source_type + review_status + confirmed_by/at. Old columns kept as
--    deprecated aliases for backward compat; will be removed in a later migration.
--
-- 5. fact_evidence → add is_primary, evidence_rank, evidence_type, superseded_at.
--
-- 6. processing_runs → new table for explicit operational traceability.
--
-- 7. analysis_snapshots → add run_id FK to processing_runs.
--
-- 8. entity_events → add run_id FK, expand event_type CHECK to include new types,
--    add actor_user_id for richer audit trail.
--
-- 9. entities → move deep_scan_* operational columns to processing_runs.
--    Keep deep_analysis_run_at + deep_analysis_stale as denormalized summary
--    fields (justified: needed for fast UI staleness check without a join).
--    Add a comment documenting the decision.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. file_texts — multi-version text records ────────────────────────────────
--
-- Rename file_text → file_texts for clarity (plural, like other tables).
-- Add text_type to distinguish raw_extracted / transcript / ocr / normalized / etc.
-- Drop the UNIQUE(file_id) constraint — multiple text records per file are now allowed.
-- The old constraint was: file_text_file_id_key

alter table file_text rename to file_texts;

-- Add text_type with a sensible default so existing rows remain valid
alter table file_texts
  add column if not exists text_type text not null default 'raw_extracted'
  check (text_type in (
    'raw_extracted',   -- first-pass extraction (PDF parse, mammoth, xlsx, passthrough)
    'transcript',      -- Whisper audio transcript
    'ocr',             -- Vision / OCR result
    'normalized',      -- cleaned/normalized for AI consumption
    'translated',      -- translated to English
    'cleaned_for_ai'   -- further cleaned/truncated for prompt use
  ));

-- Drop the old unique constraint so multiple text records per file are allowed.
-- The constraint name varies; use IF EXISTS on the index form.
drop index if exists file_text_file_id_key;
-- Also try the constraint name form (Supabase may use either)
alter table file_texts drop constraint if exists file_text_file_id_key;
alter table file_texts drop constraint if exists file_texts_file_id_key;

-- New unique constraint: one record per (file_id, text_type)
-- This allows raw_extracted + transcript + ocr etc. per file
alter table file_texts
  add constraint file_texts_file_id_text_type_key unique (file_id, text_type);

-- ── 2. file_chunks — link to specific text record ─────────────────────────────
--
-- Add file_text_id so we know exactly which text representation produced this chunk set.
-- file_id is kept for backward compatibility; new inserts should set both.

alter table file_chunks
  add column if not exists file_text_id uuid references file_texts(id) on delete cascade;

-- Index for efficient lookup by text record
create index if not exists file_chunks_file_text_id_idx on file_chunks(file_text_id);

-- ── 3. fact_definitions — stage-aware metadata ────────────────────────────────
--
-- fact_scope: which workflow stage this fact belongs to.
--   'triage'    → shown in initial review (the fixed 15-fact triage set)
--   'deep'      → surfaced during deep analysis / full fact library
--   'universal' → always relevant regardless of stage
--
-- display_order: top-level ordering within a category (supplements the join-table display_order)
-- is_user_visible_initially: whether to show in the initial triage UI
-- is_required_for_kpi: whether this fact feeds the KPI scorecard
-- industry_key: optional future industry overlay (e.g. 'saas', 'restaurant', 'manufacturing')

alter table fact_definitions
  add column if not exists fact_scope text not null default 'deep'
  check (fact_scope in ('triage', 'deep', 'universal'));

alter table fact_definitions
  add column if not exists display_order integer;

alter table fact_definitions
  add column if not exists is_user_visible_initially boolean not null default false;

alter table fact_definitions
  add column if not exists is_required_for_kpi boolean not null default false;

alter table fact_definitions
  add column if not exists industry_key text;

-- Seed the triage fact scope for the agreed 15-fact triage set
update fact_definitions
set
  fact_scope = 'triage',
  is_user_visible_initially = true
where key in (
  'asking_price',
  'location',
  'industry',
  'revenue_latest',
  'sde_or_ebitda',
  'revenue_trend',
  'profit_margin',
  'employees_ft_pt',
  'owner_hours',
  'manager_in_place',
  'years_in_business',
  'customer_concentration',
  'reason_for_sale',
  'real_estate_included',
  'inventory_included'
);

-- Also mark the triage-adjacent keys that may exist under different names
update fact_definitions
set
  fact_scope = 'triage',
  is_user_visible_initially = true
where key in (
  'sde_latest',
  'ebitda_latest',
  'revenue_latest',
  'employees_ft',
  'employees_pt',
  'business_age',
  'asking_price',
  'implied_multiple'
)
and fact_scope != 'triage';

-- Mark KPI-required facts
update fact_definitions
set is_required_for_kpi = true
where key in (
  'asking_price', 'revenue_latest', 'sde_latest', 'ebitda_latest',
  'implied_multiple', 'revenue_trend', 'profit_margin', 'customer_concentration',
  'employees_ft', 'business_age', 'owner_hours', 'manager_in_place'
);

-- ── 4. entity_fact_values — richer source/review lifecycle ────────────────────
--
-- Replace the boolean manual_override with a proper value_source_type + review_status model.
-- The old manual_override / override_* columns are kept as deprecated aliases
-- and will be removed in migration 027 after a backfill.
--
-- value_source_type: who/what produced the current value
--   'ai_extracted'    → extracted by AI from source text
--   'user_override'   → user manually set/edited the value
--   'broker_confirmed'→ confirmed by broker/seller (future)
--   'imported'        → imported from external data source (future)
--   'system_derived'  → computed by the system (e.g. implied multiple)
--
-- review_status: human-in-the-loop review state
--   'unreviewed'  → AI extracted, not yet looked at by a human
--   'confirmed'   → human confirmed the AI value is correct
--   'edited'      → human edited the value
--   'rejected'    → human rejected the AI value (fact marked missing/conflict)

alter table entity_fact_values
  add column if not exists value_source_type text not null default 'ai_extracted'
  check (value_source_type in (
    'ai_extracted',
    'user_override',
    'broker_confirmed',
    'imported',
    'system_derived'
  ));

alter table entity_fact_values
  add column if not exists review_status text not null default 'unreviewed'
  check (review_status in (
    'unreviewed',
    'confirmed',
    'edited',
    'rejected'
  ));

alter table entity_fact_values
  add column if not exists confirmed_by_user_id uuid references auth.users(id) on delete set null;

alter table entity_fact_values
  add column if not exists confirmed_at timestamptz;

alter table entity_fact_values
  add column if not exists change_reason text;

-- Backfill: rows with manual_override=true → user_override + confirmed
update entity_fact_values
set
  value_source_type = 'user_override',
  review_status = 'confirmed',
  confirmed_by_user_id = override_by,
  confirmed_at = override_at
where manual_override = true;

-- ── 5. fact_evidence — richer provenance ─────────────────────────────────────
--
-- is_primary: marks the single best/current evidence row for a fact per entity
-- evidence_rank: ordinal rank (1 = best) for ordering multiple evidence rows
-- evidence_type: what kind of extraction produced this evidence
-- superseded_at: when this evidence was superseded (for audit trail)

alter table fact_evidence
  add column if not exists is_primary boolean not null default false;

alter table fact_evidence
  add column if not exists evidence_rank integer;

alter table fact_evidence
  add column if not exists evidence_type text not null default 'ai_extraction'
  check (evidence_type in (
    'ai_extraction',    -- standard AI fact extraction
    'user_input',       -- user manually entered
    'ocr_extraction',   -- from OCR pipeline
    'transcript_extraction', -- from audio transcript
    'import',           -- imported from external source
    'system_derived'    -- computed/derived by system
  ));

alter table fact_evidence
  add column if not exists superseded_at timestamptz;

-- Index for fast primary evidence lookup
create index if not exists fact_evidence_is_primary_idx
  on fact_evidence(entity_id, fact_definition_id)
  where is_primary = true;

-- ── 6. processing_runs — explicit operational traceability ────────────────────
--
-- Tracks every system operation: text extraction, OCR, transcription,
-- fact extraction, triage generation, deep analysis, KPI scoring, etc.
-- This replaces the scattered deep_scan_* columns on entities and provides
-- a full history of reruns.

create table if not exists processing_runs (
  id                    uuid primary key default gen_random_uuid(),
  entity_id             uuid not null references entities(id) on delete cascade,

  -- What kind of operation this run represents
  run_type              text not null check (run_type in (
    'text_extraction',      -- PDF/doc/spreadsheet text extraction
    'ocr',                  -- image OCR
    'transcription',        -- audio transcription (Whisper)
    'fact_extraction',      -- AI fact extraction from text
    'triage_generation',    -- initial review / triage summary generation
    'deep_scan',            -- full deep fact scan across all files
    'deep_analysis',        -- deep AI analysis (executive summary, risks, etc.)
    'kpi_scoring',          -- KPI scorecard generation
    'valuation_support'     -- valuation support generation
  )),

  -- Operational status
  status                text not null default 'queued' check (status in (
    'queued',
    'running',
    'completed',
    'failed',
    'skipped'
  )),

  -- What triggered this run
  triggered_by_type     text not null default 'system' check (triggered_by_type in (
    'system',       -- automatic (e.g. on file upload)
    'user',         -- explicit user action
    're_run',       -- user-triggered re-run of a previous run
    'upload_event'  -- triggered by a new file/entry upload
  )),
  triggered_by_user_id  uuid references auth.users(id) on delete set null,

  -- Model / version metadata (for AI runs)
  model_name            text,
  model_version         text,
  prompt_version        text,

  -- Input traceability
  input_hash            text,        -- hash of input content (for dedup / change detection)
  related_file_id       uuid references entity_files(id) on delete set null,
  related_text_id       uuid references file_texts(id) on delete set null,

  -- Output summary (lightweight — full output goes to analysis_snapshots)
  output_summary_json   jsonb not null default '{}',

  -- Error details
  error_message         text,
  error_details_json    jsonb,

  -- Timing
  started_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now()
);

-- Indexes
create index if not exists processing_runs_entity_id_idx on processing_runs(entity_id);
create index if not exists processing_runs_entity_run_type_idx on processing_runs(entity_id, run_type);
create index if not exists processing_runs_entity_status_idx on processing_runs(entity_id, status);
create index if not exists processing_runs_created_at_idx on processing_runs(entity_id, created_at desc);

-- RLS: owner-only via entities
alter table processing_runs enable row level security;

create policy "processing_runs_owner_select"
  on processing_runs for select
  using (
    exists (
      select 1 from entities e
      where e.id = processing_runs.entity_id
        and e.owner_user_id = auth.uid()
    )
  );

create policy "processing_runs_owner_insert"
  on processing_runs for insert
  with check (
    exists (
      select 1 from entities e
      where e.id = processing_runs.entity_id
        and e.owner_user_id = auth.uid()
    )
  );

create policy "processing_runs_owner_update"
  on processing_runs for update
  using (
    exists (
      select 1 from entities e
      where e.id = processing_runs.entity_id
        and e.owner_user_id = auth.uid()
    )
  );

-- ── 7. analysis_snapshots — link to processing run ───────────────────────────
--
-- Connect each snapshot to the run that produced it.
-- Nullable for backward compat with existing snapshots.

alter table analysis_snapshots
  add column if not exists run_id uuid references processing_runs(id) on delete set null;

create index if not exists analysis_snapshots_run_id_idx on analysis_snapshots(run_id);

-- ── 8. entity_events — run_id, actor_user_id, expanded event types ────────────
--
-- Add run_id to connect events to the processing run that generated them.
-- Add actor_user_id for richer audit trail (who triggered the event).
-- Expand the event_type CHECK constraint to include all current types.

alter table entity_events
  add column if not exists run_id uuid references processing_runs(id) on delete set null;

alter table entity_events
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null;

-- Expand event_type CHECK
alter table entity_events
  drop constraint if exists entity_events_event_type_check;

alter table entity_events
  add constraint entity_events_event_type_check
  check (event_type in (
    -- File lifecycle
    'file_uploaded',
    'file_removed',
    -- Text extraction
    'text_extracted',
    'ocr_completed',
    'transcript_completed',
    -- Fact lifecycle
    'facts_extracted',
    'fact_updated',
    'fact_conflict_detected',
    'fact_manually_edited',
    'fact_manually_confirmed',
    'manual_override_applied',
    -- Analysis lifecycle
    'analysis_refreshed',
    'deep_scan_started',
    'deep_scan_completed',
    'triage_completed',
    'deep_analysis_started',
    'deep_analysis_completed',
    'initial_review_completed',
    -- Entity lifecycle
    'entity_passed',
    'entity_archived',
    'entity_deleted',
    'status_changed',
    -- Legacy / compat
    'deal_edited',
    'entry_added'
  ));

-- Index for run-based event lookup
create index if not exists entity_events_run_id_idx on entity_events(run_id);

-- ── 9. entities — document the denormalized summary fields ───────────────────
--
-- DECISION: deep_analysis_run_at and deep_analysis_stale remain on entities
-- as denormalized summary fields. Rationale:
--   - The UI needs to show the staleness banner on every page load.
--   - Deriving this from processing_runs would require a join on every page render.
--   - These two fields are updated atomically with the deep analysis run.
--   - They are NOT the source of truth for run history — processing_runs is.
--
-- deep_scan_* columns are DEPRECATED. New code should use processing_runs.
-- They are kept here to avoid breaking existing queries until migration 027.
-- Comment added to document the intent.

comment on column entities.deep_scan_status is
  'DEPRECATED: use processing_runs where run_type=''deep_scan'' instead. Kept for backward compat.';
comment on column entities.deep_scan_started_at is
  'DEPRECATED: use processing_runs instead.';
comment on column entities.deep_scan_completed_at is
  'DEPRECATED: use processing_runs instead.';
comment on column entities.deep_scan_facts_added is
  'DEPRECATED: use processing_runs.output_summary_json instead.';
comment on column entities.deep_scan_facts_updated is
  'DEPRECATED: use processing_runs.output_summary_json instead.';
comment on column entities.deep_scan_conflicts_found is
  'DEPRECATED: use processing_runs.output_summary_json instead.';

comment on column entities.deep_analysis_run_at is
  'Denormalized: last completed deep_analysis run timestamp. Kept for fast UI staleness check.';
comment on column entities.deep_analysis_stale is
  'Denormalized: true when new source material arrived after the last deep_analysis run.';
comment on column entities.latest_source_at is
  'Denormalized: timestamp of the most recent file/entry ingestion. Used for staleness comparison.';

-- ── 10. Service account / background worker policy for processing_runs ────────
--
-- Allow server-side API routes (service role) to insert/update processing_runs
-- without needing to be the entity owner. This is needed because background
-- processing runs in server context, not user context.
-- Note: service role bypasses RLS by default in Supabase — this is a no-op
-- but documents the intent for future explicit service account setup.

-- ── Done ──────────────────────────────────────────────────────────────────────
