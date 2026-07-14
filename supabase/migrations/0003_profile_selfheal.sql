-- ============================================================================
-- 0003_profile_selfheal.sql
-- Fix: a deleted profiles row never comes back on re-login.
--
-- handle_new_user() only fires on the initial INSERT into auth.users. If a
-- profile row is later deleted, the same auth.users row is reused on the next
-- sign-in, so the trigger never re-fires and the user is left with no profile.
--
-- This migration (a) backfills every orphaned auth user, and (b) adds a
-- login-time trigger on auth.sessions so a missing profile is recreated on the
-- very next sign-in, independent of the app layer. Fully idempotent.
-- ============================================================================

-- (a) Backfill any auth user currently missing a profile ----------------------
insert into public.profiles (id, email, display_name, avatar_url, is_guest)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture'),
  coalesce(u.is_anonymous, false)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- (b) Recreate a profile on every sign-in if it went missing ------------------
-- Reads the user from auth.users (auth.sessions only carries user_id), so the
-- email/name/avatar stay in sync with the identity provider.
create or replace function public.ensure_profile_on_login()
returns trigger
language plpgsql
security definer set search_path = public, auth
as $$
declare
  u auth.users%rowtype;
begin
  select * into u from auth.users where id = new.user_id;
  if not found then
    return new;
  end if;

  insert into public.profiles (id, email, display_name, avatar_url, is_guest)
  values (
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
    coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture'),
    coalesce(u.is_anonymous, false)
  )
  on conflict (id) do nothing; -- never clobber a customized profile
  return new;
end;
$$;

drop trigger if exists on_auth_session_created on auth.sessions;
create trigger on_auth_session_created
  after insert on auth.sessions
  for each row execute function public.ensure_profile_on_login();
