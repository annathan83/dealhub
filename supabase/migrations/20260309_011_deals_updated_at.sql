-- Migration: ensure deals.updated_at is always current
--
-- 1. Wire the existing set_updated_at() trigger to the deals table so that
--    any PATCH to a deal (status, fields, etc.) automatically bumps updated_at.
--
-- 2. Add a trigger on deal_sources so that adding/editing an entry or file
--    (which inserts a deal_sources row) also bumps the parent deal's updated_at.
--    This keeps the pipeline sorted by "last activity" rather than "last edit".

-- ── 0. Add updated_at column to deals ────────────────────────────────────────
alter table deals
  add column if not exists updated_at timestamptz not null default now();

-- Backfill: set updated_at = created_at for rows that pre-date this migration
update deals
set updated_at = coalesce(created_at, now())
where updated_at > now() - interval '5 seconds';

-- ── 1. Trigger: deals row self-update ────────────────────────────────────────
-- set_updated_at() already exists (created in migration 001).
-- Drop first so this migration is idempotent.
drop trigger if exists deals_updated_at on deals;

create trigger deals_updated_at
  before update on deals
  for each row execute procedure set_updated_at();

-- ── 2. Function: bump parent deal when a deal_source is inserted or updated ──
create or replace function bump_deal_updated_at()
returns trigger language plpgsql as $$
begin
  update deals
  set updated_at = now()
  where id = new.deal_id;
  return new;
end;
$$;

-- Trigger on deal_sources insert (new entry or file added)
drop trigger if exists deal_sources_bump_deal on deal_sources;

create trigger deal_sources_bump_deal
  after insert or update on deal_sources
  for each row execute procedure bump_deal_updated_at();
