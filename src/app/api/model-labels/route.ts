import { NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase/server';
import { isOwner } from '@/lib/supabase/owner';
import type { Database } from '@/lib/supabase/types';

type ModelLabelInsert = Database['public']['Tables']['model_labels']['Insert'];

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * /api/model-labels — owner-curated display names for models.
 *
 *   GET    → public list of labels (used to override raw Ollama names).
 *   PUT    → owner-only upsert of one label (display name / description / hidden).
 *   DELETE → owner-only removal of a label (model falls back to its raw name).
 *
 * Reads run under the cookie-bound client (RLS allows a public SELECT). Writes
 * are double-gated: RLS blocks all non-service writes, and the route rejects
 * anyone who isn't the configured OWNER_EMAIL before touching the admin client.
 */

export async function GET(): Promise<Response> {
  const supabase = await getSupabaseServer();
  if (!supabase) {
    // Supabase not configured — no labels, app still works with raw names.
    return NextResponse.json({ labels: [] });
  }
  const { data, error } = await supabase
    .from('model_labels')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ labels: data ?? [] });
}

interface PutBody {
  modelName?: string;
  displayName?: string;
  description?: string | null;
  hidden?: boolean;
  sortOrder?: number;
}

export async function PUT(request: Request): Promise<Response> {
  const supabase = await getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Auth is not configured.' }, { status: 500 });
  }
  if (!(await isOwner(supabase))) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const modelName = body.modelName?.trim();
  if (!modelName) {
    return NextResponse.json({ error: 'Missing "modelName".' }, { status: 400 });
  }
  const displayName = body.displayName?.trim();
  if (!displayName) {
    return NextResponse.json({ error: 'Missing "displayName".' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' },
      { status: 500 },
    );
  }

  const row: ModelLabelInsert = {
    model_name: modelName,
    display_name: displayName,
    description: body.description?.toString().trim() || null,
    hidden: Boolean(body.hidden),
    ...(typeof body.sortOrder === 'number' ? { sort_order: body.sortOrder } : {}),
  };

  const { data, error } = await admin
    .from('model_labels')
    .upsert(row, { onConflict: 'model_name' })
    .select('*')
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ label: data });
}

export async function DELETE(request: Request): Promise<Response> {
  const supabase = await getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Auth is not configured.' }, { status: 500 });
  }
  if (!(await isOwner(supabase))) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const modelName = new URL(request.url).searchParams.get('modelName')?.trim();
  if (!modelName) {
    return NextResponse.json({ error: 'Missing "modelName".' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' },
      { status: 500 },
    );
  }

  const { error } = await admin.from('model_labels').delete().eq('model_name', modelName);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
