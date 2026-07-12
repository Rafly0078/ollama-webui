'use client';

/**
 * Browser Supabase client (singleton). Uses the anon key and the user's
 * cookie-backed session. Returns null when Supabase isn't configured so the
 * app can run in pure guest/localStorage mode without crashing.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './env';

let cached: SupabaseClient<Database> | null = null;

export function getSupabaseBrowser(): SupabaseClient<Database> | null {
  if (!supabaseConfigured()) return null;
  if (cached) return cached;
  cached = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cached;
}
