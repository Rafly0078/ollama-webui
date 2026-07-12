import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './types';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

/**
 * Refresh the Supabase session on every request and forward the rotated auth
 * cookies to both the browser and any downstream Server Components. No-op when
 * Supabase isn't configured (guest-only deployments).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return response;

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Touch the user to trigger a token refresh when needed.
  await supabase.auth.getUser();

  return response;
}
