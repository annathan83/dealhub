-- ─── NDA Milestone fields on deals ──────────────────────────────────────────
-- NDA is a separate workflow milestone, NOT part of the main lifecycle status.
-- Main status remains: active | closed | passed
-- NDA milestone tracks: pending | review | signed

alter table deals
  add column if not exists nda_signed            boolean     not null default false,
  add column if not exists nda_signed_at         timestamptz,
  add column if not exists nda_signed_file_id    uuid        references entity_files(id) on delete set null,
  add column if not exists nda_signed_confidence numeric(4,3),   -- 0.000–1.000
  add column if not exists nda_signed_notes      text,
  add column if not exists nda_signed_source     text        check (nda_signed_source in ('auto','manual','override'));

-- Index for quick dashboard queries
create index if not exists deals_nda_signed_idx on deals(user_id, nda_signed);

comment on column deals.nda_signed            is 'Whether a signed NDA has been confirmed for this deal';
comment on column deals.nda_signed_at         is 'When the NDA was marked as signed';
comment on column deals.nda_signed_file_id    is 'The entity_file that triggered or confirmed the NDA milestone';
comment on column deals.nda_signed_confidence is 'Detection confidence 0–1 (null = manual override)';
comment on column deals.nda_signed_notes      is 'Detection notes or manual reason text';
comment on column deals.nda_signed_source     is 'auto = AI detected, manual = user set, override = user overrode AI';
