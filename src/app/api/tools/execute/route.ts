import { NextResponse } from 'next/server';
import { getExecutor } from '@/lib/tools/executors';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { GenerateRequest, Artifact, ToolName } from '@/lib/tools/types';
import { uid } from '@/lib/utils/id';
import { getTool } from '@/lib/tools/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/tools/execute — Execute a tool (generate a document).
 * Accepts a GenerateRequest, runs the executor, optionally persists to
 * Supabase Storage, and returns the Artifact metadata.
 */
export async function POST(request: Request): Promise<Response> {
  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.tool) {
    return NextResponse.json({ error: 'Missing "tool" field.' }, { status: 400 });
  }

  const executor = getExecutor(body.tool as ToolName);
  if (!executor) {
    return NextResponse.json({ error: `Unknown tool: ${body.tool}` }, { status: 400 });
  }

  // Get user from Supabase session
  const supabase = await getSupabaseServer();
  let userId = 'guest';

  if (supabase) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      userId = auth.user.id;
    }
  }

  try {
    const result = await executor(body, {
      userId,
      conversationId: body.conversationId,
      messageId: body.messageId,
    });

    const artifactId = uid();
    const ext = result.ext;
    const name = (body.name ?? body.title ?? 'document').replace(/\.[^.]+$/, '');
    const filename = `${name}.${ext}`;
    const storagePath = `${userId}/${artifactId}/${filename}`;

    let artifact: Artifact = {
      id: artifactId,
      kind: result.kind,
      name: filename,
      mimeType: result.mime,
      size: result.buffer.length,
      version: 1,
      createdAt: Date.now(),
      ephemeral: true,
    };

    // Persist to Supabase Storage if configured
    if (supabase && userId !== 'guest') {
      const bucket = getTool(body.tool as ToolName)?.category === 'export' ? 'exports' : 'artifacts';

      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(storagePath, result.buffer, {
          contentType: result.mime,
          upsert: false,
        });

      if (!uploadErr) {
        // Get signed URL
        const { data: urlData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(storagePath, 3600);

        artifact = {
          ...artifact,
          ephemeral: false,
          url: urlData?.signedUrl,
          bucket,
          storagePath,
        };

        // Persist artifact metadata to database
        await supabase.from('artifacts').insert({
          id: artifactId,
          user_id: userId,
          conversation_id: body.conversationId ?? null,
          message_id: body.messageId ?? null,
          kind: result.kind,
          name: filename,
          mime_type: result.mime,
          size_bytes: result.buffer.length,
          bucket,
          storage_path: storagePath,
          version: 1,
          metadata: {},
        });

        // Create download record
        await supabase.from('downloads').insert({
          id: uid(),
          user_id: userId,
          artifact_id: artifactId,
          name: filename,
          status: 'ready',
          progress: 100,
          size_bytes: result.buffer.length,
          bucket,
          storage_path: storagePath,
        });
      }
    }

    // For guest mode or if storage upload failed, return as data URL
    if (artifact.ephemeral) {
      const base64 = result.buffer.toString('base64');
      artifact.url = `data:${result.mime};base64,${base64}`;
    }

    return NextResponse.json({ artifact }, { status: 200 });
  } catch (err) {
    console.error('Tool execution failed:', err);
    const message = err instanceof Error ? err.message : 'Tool execution failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
