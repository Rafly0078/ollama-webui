import { NextResponse } from 'next/server';
import { BridgeError, bridgeConfigured } from '@/lib/bridge/config';
import { upstreamChat } from '@/lib/bridge/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/bridge/chat — proxy a chat completion (streaming or not).
 * Streams the upstream body straight through so tokens reach the client with
 * no added buffering. The frontend's stream parser is unchanged.
 */
export async function POST(request: Request): Promise<Response> {
  if (!bridgeConfigured()) {
    return NextResponse.json({ error: 'Bridge not configured.' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    const res = await upstreamChat(body, request.signal);
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      return new NextResponse(text || JSON.stringify({ error: 'Upstream error.' }), {
        status: res.ok ? 502 : res.status,
        headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
      });
    }
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'application/x-ndjson',
        'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    const status = err instanceof BridgeError ? err.status : 502;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upstream error.' },
      { status },
    );
  }
}
