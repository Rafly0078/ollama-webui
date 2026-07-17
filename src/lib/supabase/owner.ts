import 'server-only';

/**
 * Owner gating. The "owner" is whoever can curate model display names.
 * Configured via the server-only OWNER_EMAIL env var (comma-separated to allow
 * more than one). Never shipped to the browser — the UI asks the server whether
 * the current user is the owner via /api/model-labels/is-owner.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/** Lowercased set of owner emails from OWNER_EMAIL (comma-separated). */
function ownerEmails(): string[] {
  return (process.env.OWNER_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True when at least one owner email is configured. */
export function ownerConfigured(): boolean {
  return ownerEmails().length > 0;
}

/**
 * Resolve whether the request's signed-in user is an owner. Reads the user from
 * the cookie-bound server client (so it can't be spoofed from the client) and
 * matches their verified email against OWNER_EMAIL.
 */
export async function isOwner(supabase: SupabaseClient<Database>): Promise<boolean> {
  const allowed = ownerEmails();
  if (allowed.length === 0) return false;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return false;
  if (data.user.is_anonymous) return false;
  return allowed.includes(data.user.email.toLowerCase());
}
