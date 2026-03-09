-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 029: deal-files Supabase Storage bucket + RLS
--
-- Creates a private bucket for deal file uploads when Google Drive is not
-- connected. Files are stored at: {user_id}/{deal_id}/{filename}
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deal-files', 'deal-files', false, 104857600, null)
on conflict (id) do nothing;

-- Users can only access files under their own user_id prefix
create policy "Users can upload their own deal files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'deal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can read their own deal files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'deal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own deal files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'deal-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
