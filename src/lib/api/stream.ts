import type { ChatStreamChunk } from './types';

/**
 * Parse a streamed HTTP body into chat chunks. Supports both:
 *  - NDJSON (Ollama native): one JSON object per line
 *  - SSE: lines prefixed with `data: `, terminated by `data: [DONE]`
 *
 * Yields decoded chunks incrementally. Robust to partial lines across reads.
 */
/**
 * Thrown when the upstream body contained real data but none of it was
 * parseable as a chat chunk — e.g. an HTML error page, a truncated response,
 * or a JSON shape this parser doesn't recognize. Carries a snippet of the raw
 * body so the failure is diagnosable instead of silently producing nothing.
 */
export class StreamParseError extends Error {
  raw: string;
  constructor(raw: string) {
    super(
      `The server's response could not be parsed as a chat stream. Raw response (truncated): ${raw.slice(0, 300)}`,
    );
    this.name = 'StreamParseError';
    this.raw = raw;
  }
}

export async function* parseChatStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Diagnostics: did we ever see a genuinely parseable chunk, and how much
  // raw text did we receive overall? Lets us tell "quiet keepalive stream"
  // apart from "the whole response was garbage".
  let sawValidChunk = false;
  let rawSeen = '';
  const RAW_SNIPPET_CAP = 2000;

  const trackRaw = (s: string) => {
    if (rawSeen.length < RAW_SNIPPET_CAP) rawSeen += s;
  };

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      const decoded = decoder.decode(value, { stream: true });
      buffer += decoded;

      // Split on newlines; keep the trailing partial line in the buffer.
      let nlIndex: number;
      while ((nlIndex = buffer.indexOf('\n')) >= 0) {
        const rawLine = buffer.slice(0, nlIndex).trim();
        buffer = buffer.slice(nlIndex + 1);
        if (rawLine) trackRaw(rawLine + '\n');
        const chunk = decodeLine(rawLine);
        if (chunk) {
          sawValidChunk = true;
          yield chunk;
        }
      }
    }
    // Flush any final buffered line.
    const tail = buffer.trim();
    if (tail) {
      trackRaw(tail);
      const chunk = decodeLine(tail);
      if (chunk) {
        sawValidChunk = true;
        yield chunk;
      }
    }

    // The stream ended, we received bytes, but none of them were a chunk we
    // could understand. Previously this was swallowed entirely (treated the
    // same as harmless keepalive noise), which left the UI with an empty
    // assistant message and no indication anything went wrong. Surface it.
    if (!sawValidChunk && rawSeen.trim() && !signal?.aborted) {
      throw new StreamParseError(rawSeen);
    }
  } finally {
    // Ensure the underlying connection is released even on early break.
    try {
      await reader.cancel();
    } catch {
      /* noop */
    }
    reader.releaseLock();
  }
}

function decodeLine(line: string): ChatStreamChunk | null {
  if (!line) return null;
  // SSE comment/keepalive lines start with ':' and carry no data.
  if (line.startsWith(':')) return null;
  let payload = line;
  if (line.startsWith('data:')) {
    payload = line.slice(5).trim();
    if (payload === '[DONE]') return { done: true };
  }
  try {
    return JSON.parse(payload) as ChatStreamChunk;
  } catch {
    // Not valid JSON. Could be a genuine oddity from the server; the caller
    // decides (via sawValidChunk bookkeeping) whether an all-garbage stream
    // should be reported as an error.
    return null;
  }
}

/** Extract the text delta from a chunk regardless of endpoint shape. */
export function chunkText(chunk: ChatStreamChunk): string {
  return chunk.message?.content ?? chunk.response ?? '';
}
