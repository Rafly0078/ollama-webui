'use client';

/** Profile + preferences persistence for the signed-in user. */

import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { ProfileRow } from '@/lib/supabase/types';

export async function getProfile(): Promise<ProfileRow | null> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProfile(patch: Partial<Pick<ProfileRow, 'display_name' | 'avatar_url'>>): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase.from('profiles').update(patch).eq('id', auth.user.id);
  if (error) throw new Error(error.message);
}

/** Human label for a user, guest-aware. */
export function userLabel(user: User | null): string {
  if (!user) return 'Guest';
  if (user.is_anonymous) return 'Guest';
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name || meta?.name || user.email || 'Account';
}
