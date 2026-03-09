-- Migration 030: Simplify deal status to 3 values
--
-- New status model:
--   active  — deal is being worked on (was: new, triaged, investigating, reviewing,
--              due_diligence, offer, loi)
--   closed  — deal was successfully acquired (was: acquired)
--   passed  — deal was declined / archived (was: passed, archived)
--
-- The timeline (entity_events) now carries detailed progression instead of status.

-- 1. Migrate existing data before tightening the constraint
update deals
set status = case
  when status in ('new', 'triaged', 'investigating', 'reviewing',
                  'due_diligence', 'offer', 'loi')   then 'active'
  when status = 'acquired'                            then 'closed'
  when status in ('passed', 'archived', 'closed')    then 'passed'
  else 'active'
end
where status is not null;

-- 2. Replace the check constraint with the new 3-value set
alter table deals
  drop constraint if exists deals_status_check;

alter table deals
  add constraint deals_status_check
  check (status in ('active', 'closed', 'passed'));

-- 3. Set a safe default for any rows that had a null status
update deals set status = 'active' where status is null;

alter table deals
  alter column status set default 'active',
  alter column status set not null;
