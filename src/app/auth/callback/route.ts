import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * OAuth / magic-link callback. Exchanges the `code` for a session (PKCE) and
 * redirects to `next` (default: home). Cookies are set via the server client.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await getSupabaseServer();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
      return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error.message)}`);
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
}
