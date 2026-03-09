-- ── user_feedback ────────────────────────────────────────────────────────────
-- Stores in-app feedback submitted by users at any point in the app.
-- Captures the page/context they were on, a sentiment rating, and free text.

create table if not exists public.user_feedback (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,

  -- Where in the app the feedback was submitted
  page_path      text,                        -- e.g. /deals/abc123
  page_context   text,                        -- e.g. "deal_detail", "dashboard"
  deal_id        uuid references public.deals(id) on delete set null,

  -- The feedback itself
  rating         smallint check (rating between 1 and 5),
  category       text,                        -- "bug", "feature", "ux", "other"
  message        text not null,

  -- Metadata
  user_agent     text,
  app_version    text,
  created_at     timestamptz not null default now()
);

-- Index for admin review queries
create index on public.user_feedback (created_at desc);
create index on public.user_feedback (user_id);
create index on public.user_feedback (category);

-- RLS: users can insert their own feedback; only service role can read all
alter table public.user_feedback enable row level security;

create policy "Users can submit feedback"
  on public.user_feedback for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

-- Users can see their own submissions (optional, useful for "thank you" confirmation)
create policy "Users can view own feedback"
  on public.user_feedback for select
  to authenticated
  using (auth.uid() = user_id);
