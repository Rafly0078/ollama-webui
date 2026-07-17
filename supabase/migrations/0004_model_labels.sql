-- ============================================================================
-- 0004_model_labels.sql — owner-managed display names for models
--
-- The model dropdown fetches the raw model list from Ollama; each entry can be
-- given a friendly display name / description here so ALL visitors see the
-- curated name instead of the raw tag (e.g. "hf.co/Jackrong/Qwen3.5-4B-..." →
-- "Qwen 3.5"). Rows are keyed by the raw model name coming from Ollama.
--
-- Access model (intentionally different from the per-user tables):
--   • SELECT is PUBLIC — every visitor (including anon/guest) reads the labels.
--   • No INSERT/UPDATE/DELETE policy → RLS blocks all writes for regular users.
--     Writes happen ONLY server-side via the service-role key, gated by an
--     OWNER_EMAIL check in the /api/model-labels route. Two layers of defense.
-- ============================================================================

create table if not exists public.model_labels (
  model_name   text primary key,
  display_name text not null,
  description  text,
  hidden       boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger model_labels_updated_at
  before update on public.model_labels
  for each row execute function public.set_updated_at();

alter table public.model_labels enable row level security;

-- Public read: anyone (authenticated, anon, or guest) may read the curated list.
create policy "model_labels_select_public" on public.model_labels
  for select using (true);

-- No write policies on purpose — all mutations go through the service-role
-- client behind the owner check in the API route.
