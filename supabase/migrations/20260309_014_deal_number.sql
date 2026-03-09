-- Migration 014: add deal_number — a per-user sequential counter (00001, 00002…)
-- Used as the human-readable prefix in Google Drive folder names.

-- ── 1. Add column ─────────────────────────────────────────────────────────────
alter table deals add column if not exists deal_number integer;

-- ── 2. Backfill existing rows ordered by created_at per user ─────────────────
with numbered as (
  select id,
         row_number() over (partition by user_id order by created_at) as n
  from deals
)
update deals d
set deal_number = numbered.n
from numbered
where d.id = numbered.id
  and d.deal_number is null;

-- ── 3. Make non-nullable ──────────────────────────────────────────────────────
alter table deals alter column deal_number set not null;

-- ── 4. Trigger function: assign next number for this user on INSERT ───────────
create or replace function assign_deal_number()
returns trigger language plpgsql as $$
begin
  select coalesce(max(deal_number), 0) + 1
  into new.deal_number
  from deals
  where user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists deals_assign_number on deals;
create trigger deals_assign_number
  before insert on deals
  for each row
  when (new.deal_number is null)
  execute procedure assign_deal_number();

-- ── 5. Unique constraint: no two deals for the same user share a number ───────
create unique index if not exists deals_user_number_unique
  on deals(user_id, deal_number);
