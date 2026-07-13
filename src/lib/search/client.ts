'use client';

import type { SearchResponse } from './types';

/**
 * Call the server search route. The provider + API key live on the server; the
 * browser only ever sees normalized results. Throws with a user-facing message
 * so the chat flow can toast it and fall back to answering without the web.
 */
export async function searchWeb(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });

  if (!res.ok) {
    let message = `Search failed (${res.status}).`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) message = j.error;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }

  return (await res.json()) as SearchResponse;
}
