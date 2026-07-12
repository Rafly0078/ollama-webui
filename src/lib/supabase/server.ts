import 'server-only';

/**
 * Server Supabase clients for Route Handlers and Server Components.
 * Cookie-bound so RLS runs as the signed-in user. The service-role client
 * bypasses RLS and must only be used in trusted server code.
 */

import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from './types';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

/** Request-scoped client that reads/writes the auth cookie. */
export async function getSupabaseServer(): Promise<SupabaseClient<Database> | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render — cookies are read-only there.
          // Middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Service-role client — bypasses RLS. Use ONLY for trusted server tasks that
 * cannot run as the user (e.g. system writes). Never expose to the client.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
