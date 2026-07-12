-- ============================================================================
-- 0002_rls.sql — Row Level Security + Storage buckets
-- Every table: owner-only access keyed on user_id = auth.uid().
-- profiles keyed on id. Child tables (messages, versions) also verified via
-- their parent's user_id for defense in depth.
-- ============================================================================

-- Enable RLS everywhere -------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.workspaces         enable row level security;
alter table public.conversations      enable row level security;
alter table public.messages           enable row level security;
alter table public.attachments        enable row level security;
alter table public.artifacts          enable row level security;
alter table public.downloads          enable row level security;
alter table public.documents          enable row level security;
alter table public.document_versions  enable row level security;
alter table public.saved_prompts      enable row level security;
alter table public.installed_models   enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.user_preferences   enable row level security;
alter table public.activity_logs      enable row level security;

-- profiles: user manages only their own row -----------------------------------
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Generic owner policy generator via explicit statements ----------------------
-- workspaces
create policy "workspaces_all_own" on public.workspaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- conversations
create policy "conversations_all_own" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- messages
create policy "messages_all_own" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- attachments
create policy "attachments_all_own" on public.attachments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- artifacts
create policy "artifacts_all_own" on public.artifacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- downloads
create policy "downloads_all_own" on public.downloads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- documents
create policy "documents_all_own" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- document_versions
create policy "document_versions_all_own" on public.document_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- saved_prompts
create policy "saved_prompts_all_own" on public.saved_prompts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- installed_models
create policy "installed_models_all_own" on public.installed_models
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- workspace_settings
create policy "workspace_settings_all_own" on public.workspace_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_preferences
create policy "user_preferences_all_own" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- activity_logs: insert + read own; no update/delete --------------------------
create policy "activity_logs_select_own" on public.activity_logs
  for select using (auth.uid() = user_id);
create policy "activity_logs_insert_own" on public.activity_logs
  for insert with check (auth.uid() = user_id);

-- ============================================================================
-- Storage buckets. All private; access via signed URLs from the service layer.
-- Convention: first path segment is the owner's uid → "<uid>/<...>".
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('uploads',          'uploads',          false),
  ('artifacts',        'artifacts',        false),
  ('generated',        'generated',        false),
  ('exports',          'exports',          false),
  ('avatars',          'avatars',          false),
  ('images',           'images',           false),
  ('workspace-assets', 'workspace-assets', false)
on conflict (id) do nothing;

-- Storage RLS: owner-scoped by leading path segment ---------------------------
-- Applies to every bucket above; a user may only touch objects under "<uid>/".
create policy "storage_read_own" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('uploads','artifacts','generated','exports','avatars','images','workspace-assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('uploads','artifacts','generated','exports','avatars','images','workspace-assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('uploads','artifacts','generated','exports','avatars','images','workspace-assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('uploads','artifacts','generated','exports','avatars','images','workspace-assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
