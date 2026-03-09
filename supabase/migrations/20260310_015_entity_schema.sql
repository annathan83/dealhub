-- ============================================================================
-- Migration 015: Generic Entity-Fact-Evidence schema
--
-- Introduces a provider-agnostic, entity-type-driven architecture alongside
-- the existing deal model. Nothing in this migration touches existing tables.
-- ============================================================================

-- ── A. entity_types ───────────────────────────────────────────────────────────
create table if not exists entity_types (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  label       text not null,
  description text,
  created_at  timestamptz not null default now()
);

alter table entity_types enable row level security;
-- entity_types is a reference table — readable by all authenticated users
create policy "Authenticated users can read entity_types"
  on entity_types for select
  using (auth.role() = 'authenticated');

-- ── B. entities ───────────────────────────────────────────────────────────────
create table if not exists entities (
  id              uuid primary key default gen_random_uuid(),
  entity_type_id  uuid not null references entity_types(id),
  legacy_deal_id  uuid,                    -- bridge to existing deals table
  title           text not null,
  subtitle        text,
  status          text,
  owner_user_id   uuid references auth.users(id) on delete cascade,
  workspace_id    uuid,                    -- future: multi-workspace support
  metadata_json   jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz
);

create index if not exists entities_owner_idx         on entities(owner_user_id);
create index if not exists entities_legacy_deal_idx   on entities(legacy_deal_id) where legacy_deal_id is not null;
create index if not exists entities_type_idx          on entities(entity_type_id);
create unique index if not exists entities_legacy_deal_unique on entities(legacy_deal_id) where legacy_deal_id is not null;

alter table entities enable row level security;
create policy "Users manage own entities"
  on entities for all
  using (auth.uid() = owner_user_id);

drop trigger if exists entities_updated_at on entities;
create trigger entities_updated_at
  before update on entities
  for each row execute procedure set_updated_at();

-- ── C. entity_files ───────────────────────────────────────────────────────────
create table if not exists entity_files (
  id              uuid primary key default gen_random_uuid(),
  entity_id       uuid not null references entities(id) on delete cascade,
  legacy_deal_id  uuid,                    -- bridge: mirrors deal_files.deal_id
  storage_path    text not null,           -- Google Drive file ID or storage path
  file_name       text not null,
  mime_type       text,
  file_size_bytes bigint,
  source_type     text,                    -- 'uploaded_file' | 'webcam_photo' | 'audio_recording' | 'pasted_text' | 'ai_assessment'
  document_type   text,                    -- AI-detected: 'financial_statement' | 'listing' | 'email' | etc.
  uploaded_by     uuid references auth.users(id) on delete set null,
  uploaded_at     timestamptz not null default now(),
  metadata_json   jsonb not null default '{}'::jsonb
);

create index if not exists entity_files_entity_idx      on entity_files(entity_id);
create index if not exists entity_files_legacy_deal_idx on entity_files(legacy_deal_id) where legacy_deal_id is not null;
create index if not exists entity_files_uploaded_at_idx on entity_files(entity_id, uploaded_at desc);

alter table entity_files enable row level security;
create policy "Users manage own entity_files"
  on entity_files for all
  using (
    exists (
      select 1 from entities e
      where e.id = entity_files.entity_id
        and e.owner_user_id = auth.uid()
    )
  );

-- ── D. file_text ──────────────────────────────────────────────────────────────
create table if not exists file_text (
  id                 uuid primary key default gen_random_uuid(),
  file_id            uuid not null references entity_files(id) on delete cascade,
  full_text          text,
  language           text,
  extraction_method  text,                 -- 'pdf-parse' | 'whisper' | 'vision' | 'mammoth' | 'xlsx' | 'passthrough'
  extraction_status  text not null default 'pending',  -- 'pending' | 'done' | 'failed' | 'skipped'
  extracted_at       timestamptz,
  metadata_json      jsonb not null default '{}'::jsonb
);

create unique index if not exists file_text_file_unique on file_text(file_id);
create index if not exists file_text_status_idx on file_text(extraction_status) where extraction_status = 'pending';

alter table file_text enable row level security;
create policy "Users manage own file_text"
  on file_text for all
  using (
    exists (
      select 1 from entity_files ef
      join entities e on e.id = ef.entity_id
      where ef.id = file_text.file_id
        and e.owner_user_id = auth.uid()
    )
  );

-- ── E. file_chunks ────────────────────────────────────────────────────────────
create table if not exists file_chunks (
  id            uuid primary key default gen_random_uuid(),
  file_id       uuid not null references entity_files(id) on delete cascade,
  chunk_index   integer not null,
  text          text not null,
  page_number   integer,
  token_count   integer,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create unique index if not exists file_chunks_file_chunk_unique on file_chunks(file_id, chunk_index);
create index if not exists file_chunks_file_idx on file_chunks(file_id);

alter table file_chunks enable row level security;
create policy "Users manage own file_chunks"
  on file_chunks for all
  using (
    exists (
      select 1 from entity_files ef
      join entities e on e.id = ef.entity_id
      where ef.id = file_chunks.file_id
        and e.owner_user_id = auth.uid()
    )
  );

-- ── F. fact_definitions ───────────────────────────────────────────────────────
create table if not exists fact_definitions (
  id              uuid primary key default gen_random_uuid(),
  key             text unique not null,
  label           text not null,
  description     text,
  category        text,                    -- 'financial' | 'operations' | 'real_estate' | 'deal_terms' | 'people'
  data_type       text not null,           -- 'currency' | 'number' | 'percent' | 'text' | 'boolean' | 'date'
  is_critical     boolean not null default false,
  is_multi_value  boolean not null default false,
  metadata_json   jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

alter table fact_definitions enable row level security;
create policy "Authenticated users can read fact_definitions"
  on fact_definitions for select
  using (auth.role() = 'authenticated');

-- ── G. fact_definition_entity_types ──────────────────────────────────────────
create table if not exists fact_definition_entity_types (
  id                  uuid primary key default gen_random_uuid(),
  fact_definition_id  uuid not null references fact_definitions(id) on delete cascade,
  entity_type_id      uuid not null references entity_types(id) on delete cascade,
  is_required         boolean not null default false,
  display_order       integer
);

create unique index if not exists fdet_unique on fact_definition_entity_types(fact_definition_id, entity_type_id);
create index if not exists fdet_entity_type_idx on fact_definition_entity_types(entity_type_id);

alter table fact_definition_entity_types enable row level security;
create policy "Authenticated users can read fact_definition_entity_types"
  on fact_definition_entity_types for select
  using (auth.role() = 'authenticated');

-- ── H. fact_evidence ──────────────────────────────────────────────────────────
create table if not exists fact_evidence (
  id                    uuid primary key default gen_random_uuid(),
  entity_id             uuid not null references entities(id) on delete cascade,
  fact_definition_id    uuid not null references fact_definitions(id),
  file_id               uuid not null references entity_files(id) on delete cascade,
  file_chunk_id         uuid references file_chunks(id) on delete set null,
  extracted_value_raw   text,
  normalized_value_json jsonb not null default '{}'::jsonb,
  snippet               text,
  page_number           integer,
  confidence            numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  extractor_version     text,
  evidence_status       text not null default 'candidate',  -- 'candidate' | 'accepted' | 'rejected'
  is_superseded         boolean not null default false,
  is_conflicting        boolean not null default false,
  created_at            timestamptz not null default now()
);

create index if not exists fact_evidence_entity_idx      on fact_evidence(entity_id);
create index if not exists fact_evidence_fact_idx        on fact_evidence(fact_definition_id);
create index if not exists fact_evidence_file_idx        on fact_evidence(file_id);
create index if not exists fact_evidence_entity_fact_idx on fact_evidence(entity_id, fact_definition_id);
create index if not exists fact_evidence_active_idx      on fact_evidence(entity_id, fact_definition_id, is_superseded) where not is_superseded;

alter table fact_evidence enable row level security;
create policy "Users manage own fact_evidence"
  on fact_evidence for all
  using (
    exists (
      select 1 from entities e
      where e.id = fact_evidence.entity_id
        and e.owner_user_id = auth.uid()
    )
  );

-- ── I. entity_fact_values ─────────────────────────────────────────────────────
create table if not exists entity_fact_values (
  id                    uuid primary key default gen_random_uuid(),
  entity_id             uuid not null references entities(id) on delete cascade,
  fact_definition_id    uuid not null references fact_definitions(id),
  value_raw             text,
  value_normalized_json jsonb not null default '{}'::jsonb,
  status                text not null default 'missing',  -- 'confirmed' | 'unclear' | 'missing' | 'conflicting' | 'estimated'
  confidence            numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  current_evidence_id   uuid references fact_evidence(id) on delete set null,
  updated_at            timestamptz not null default now()
);

create unique index if not exists efv_entity_fact_unique on entity_fact_values(entity_id, fact_definition_id);
create index if not exists efv_entity_idx  on entity_fact_values(entity_id);
create index if not exists efv_status_idx  on entity_fact_values(entity_id, status);

alter table entity_fact_values enable row level security;
create policy "Users manage own entity_fact_values"
  on entity_fact_values for all
  using (
    exists (
      select 1 from entities e
      where e.id = entity_fact_values.entity_id
        and e.owner_user_id = auth.uid()
    )
  );

drop trigger if exists entity_fact_values_updated_at on entity_fact_values;
create trigger entity_fact_values_updated_at
  before update on entity_fact_values
  for each row execute procedure set_updated_at();

-- ── J. analysis_snapshots ─────────────────────────────────────────────────────
create table if not exists analysis_snapshots (
  id              uuid primary key default gen_random_uuid(),
  entity_id       uuid not null references entities(id) on delete cascade,
  analysis_type   text not null,           -- 'deal_assessment' | 'valuation' | 'risk_flags' | 'questions'
  title           text,
  content_json    jsonb not null default '{}'::jsonb,
  model_name      text,
  prompt_version  text,
  created_at      timestamptz not null default now()
);

create index if not exists analysis_snapshots_entity_idx      on analysis_snapshots(entity_id);
create index if not exists analysis_snapshots_entity_type_idx on analysis_snapshots(entity_id, analysis_type, created_at desc);

alter table analysis_snapshots enable row level security;
create policy "Users manage own analysis_snapshots"
  on analysis_snapshots for all
  using (
    exists (
      select 1 from entities e
      where e.id = analysis_snapshots.entity_id
        and e.owner_user_id = auth.uid()
    )
  );

-- ── K. entity_events ──────────────────────────────────────────────────────────
create table if not exists entity_events (
  id                  uuid primary key default gen_random_uuid(),
  entity_id           uuid not null references entities(id) on delete cascade,
  event_type          text not null,       -- 'file_uploaded' | 'text_extracted' | 'facts_extracted' | 'fact_updated' | 'fact_conflict_detected' | 'analysis_refreshed'
  file_id             uuid references entity_files(id) on delete set null,
  fact_definition_id  uuid references fact_definitions(id) on delete set null,
  metadata_json       jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists entity_events_entity_idx      on entity_events(entity_id);
create index if not exists entity_events_entity_time_idx on entity_events(entity_id, created_at desc);
create index if not exists entity_events_type_idx        on entity_events(entity_id, event_type);

alter table entity_events enable row level security;
create policy "Users manage own entity_events"
  on entity_events for all
  using (
    exists (
      select 1 from entities e
      where e.id = entity_events.entity_id
        and e.owner_user_id = auth.uid()
    )
  );
