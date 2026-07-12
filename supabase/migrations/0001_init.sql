-- ============================================================================
-- 0001_init.sql — AI Workspace core schema
-- UUID keys, timestamps everywhere, FKs, optimized indexes.
-- RLS + storage live in 0002_rls.sql. Keep this file structural only.
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- fast ILIKE search on titles/content

-- Reusable updated_at trigger -------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles: 1:1 with auth.users -----------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  is_guest     boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new auth user appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, is_guest)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce((new.is_anonymous)::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- workspaces: top-level container per user ------------------------------------
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  name        text not null default 'My Workspace',
  icon        text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index workspaces_user_idx on public.workspaces (user_id);
create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- conversations ---------------------------------------------------------------
create table public.conversations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  workspace_id  uuid references public.workspaces (id) on delete set null,
  title         text not null default 'New chat',
  model         text not null default '',
  system_prompt text not null default '',
  params        jsonb not null default '{}'::jsonb,
  folder        text,
  pinned        boolean not null default false,
  favorite      boolean not null default false,
  archived      boolean not null default false,
  -- Branching support: a conversation can fork from another.
  parent_id     uuid references public.conversations (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);
create index conversations_workspace_idx on public.conversations (workspace_id);
create index conversations_title_trgm_idx on public.conversations using gin (title gin_trgm_ops);
create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- messages --------------------------------------------------------------------
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            text not null check (role in ('system', 'user', 'assistant')),
  content         text not null default '',
  model           text,
  metrics         jsonb,
  error           text,
  -- Message-tree branching: parent message this one replies to / regenerates.
  parent_id       uuid references public.messages (id) on delete set null,
  seq             bigint not null default 0,   -- monotonic order within a conversation
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index messages_convo_seq_idx on public.messages (conversation_id, seq);
create index messages_content_trgm_idx on public.messages using gin (content gin_trgm_ops);
create trigger messages_updated_at
  before update on public.messages
  for each row execute function public.set_updated_at();

-- attachments: files uploaded to a message ------------------------------------
create table public.attachments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  message_id      uuid references public.messages (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  name            text not null,
  mime_type       text not null,
  size_bytes      bigint not null default 0,
  bucket          text not null default 'uploads',
  storage_path    text not null,
  extracted_text  text,
  created_at      timestamptz not null default now()
);
create index attachments_message_idx on public.attachments (message_id);
create index attachments_user_idx on public.attachments (user_id);

-- artifacts: generated outputs shown in the artifact panel --------------------
create table public.artifacts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  message_id      uuid references public.messages (id) on delete set null,
  kind            text not null,   -- pdf|docx|pptx|xlsx|zip|md|html|json|txt|...
  name            text not null,
  mime_type       text,
  size_bytes      bigint not null default 0,
  bucket          text not null default 'artifacts',
  storage_path    text not null,
  version         integer not null default 1,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index artifacts_conversation_idx on public.artifacts (conversation_id);
create index artifacts_user_created_idx on public.artifacts (user_id, created_at desc);
create trigger artifacts_updated_at
  before update on public.artifacts
  for each row execute function public.set_updated_at();

-- downloads: download-manager rows --------------------------------------------
create table public.downloads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  artifact_id  uuid references public.artifacts (id) on delete set null,
  name         text not null,
  status       text not null default 'ready' check (status in ('pending','processing','ready','failed')),
  progress     integer not null default 100,
  size_bytes   bigint not null default 0,
  bucket       text,
  storage_path text,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index downloads_user_created_idx on public.downloads (user_id, created_at desc);
create trigger downloads_updated_at
  before update on public.downloads
  for each row execute function public.set_updated_at();

-- documents + versions: editable uploaded/generated docs ----------------------
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  name            text not null,
  doc_type        text not null,   -- source format: pdf|docx|md|...
  current_version integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index documents_user_idx on public.documents (user_id);
create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create table public.document_versions (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  version      integer not null,
  bucket       text not null default 'generated',
  storage_path text not null,
  size_bytes   bigint not null default 0,
  note         text,
  created_at   timestamptz not null default now(),
  unique (document_id, version)
);
create index document_versions_doc_idx on public.document_versions (document_id, version desc);

-- saved_prompts ---------------------------------------------------------------
create table public.saved_prompts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  content    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_prompts_user_idx on public.saved_prompts (user_id);
create trigger saved_prompts_updated_at
  before update on public.saved_prompts
  for each row execute function public.set_updated_at();

-- installed_models: per-user cache of Ollama model metadata -------------------
create table public.installed_models (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  name           text not null,
  family         text,
  parameter_size text,
  quantization   text,
  size_bytes     bigint,
  context_length integer,
  supports_vision boolean not null default false,
  raw            jsonb,
  updated_at     timestamptz not null default now(),
  unique (user_id, name)
);
create index installed_models_user_idx on public.installed_models (user_id);
create trigger installed_models_updated_at
  before update on public.installed_models
  for each row execute function public.set_updated_at();

-- workspace_settings ----------------------------------------------------------
create table public.workspace_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  settings     jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);
create trigger workspace_settings_updated_at
  before update on public.workspace_settings
  for each row execute function public.set_updated_at();

-- user_preferences: 1:1 with profile ------------------------------------------
create table public.user_preferences (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- activity_logs ---------------------------------------------------------------
create table public.activity_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  action     text not null,
  target     text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_logs_user_created_idx on public.activity_logs (user_id, created_at desc);
