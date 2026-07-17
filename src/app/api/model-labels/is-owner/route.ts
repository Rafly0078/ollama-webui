import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isOwner, ownerConfigured } from '@/lib/supabase/owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/model-labels/is-owner — whether the current user may curate model
 * names. Used purely to decide if the edit UI shows; every write is re-checked
 * server-side, so a spoofed `true` here grants nothing.
 */
export async function GET(): Promise<Response> {
  const supabase = await getSupabaseServer();
  if (!supabase || !ownerConfigured()) {
    return NextResponse.json({ isOwner: false });
  }
  return NextResponse.json({ isOwner: await isOwner(supabase) });
}
