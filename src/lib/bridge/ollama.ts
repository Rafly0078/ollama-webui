import 'server-only';

import { BridgeError, getBridgeTarget } from './config';

/**
 * Thin server-side fetchers against the Ollama-compatible upstream. Endpoint
 * fallbacks mirror the previous client so no upstream behavior changes.
 */

const TAG_PATHS = ['/api/tags', '/api/models'];
const CHAT_PATHS = ['/api/chat', '/api/chat/stream'];
const SHOW_PATHS = ['/api/show'];

function url(path: string): string {
  const base = getBridgeTarget();
  if (!base) throw new BridgeError('Ollama target not configured on the server.', 500);
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Try each candidate path until one responds without 404/405. */
async function fetchFallback(paths: string[], init: RequestInit): Promise<Response> {
  let last: Response | null = null;
  for (const p of paths) {
    const res = await fetch(url(p), init);
    if (res.ok) return res;
    if (res.status === 404 || res.status === 405) {
      last = res;
      continue;
    }
    return res;
  }
  if (last) return last;
  throw new BridgeError('Unable to reach any upstream route.');
}

export function upstreamModels(signal?: AbortSignal): Promise<Response> {
  return fetchFallback(TAG_PATHS, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
}

export function upstreamShow(name: string, signal?: AbortSignal): Promise<Response> {
  return fetchFallback(SHOW_PATHS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, model: name }),
    signal,
  });
}

export function upstreamChat(body: unknown, signal?: AbortSignal): Promise<Response> {
  return fetchFallback(CHAT_PATHS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson, text/event-stream',
    },
    body: JSON.stringify(body),
    signal,
  });
}
