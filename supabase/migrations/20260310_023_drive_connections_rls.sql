-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 023: Add RLS policy for google_drive_connections
--
-- Migration 013 enabled RLS on google_drive_connections but added no policies,
-- which means all reads and writes are denied by default. This migration adds
-- the missing policy so users can read and write their own connection row.
--
-- google_oauth_tokens already has a policy (added manually in the dashboard),
-- so we only need to fix google_drive_connections here.
-- ─────────────────────────────────────────────────────────────────────────────

create policy "Users can manage their own drive connection"
  on google_drive_connections
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
