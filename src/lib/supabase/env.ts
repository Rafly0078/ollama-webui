/**
 * Supabase environment access. Public URL + anon key are safe in the browser;
 * the service-role key is server-only and must never be imported client-side.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True when the public config is present — gates authed features in the UI. */
export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
