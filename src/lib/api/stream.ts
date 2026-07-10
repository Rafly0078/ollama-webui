import type { ChatStreamChunk } from './types';

/**
 * Parse a streamed HTTP body into chat chunks. Supports both:
 *  - NDJSON (Ollama native): one JSON object per line
 *  - SSE: lines prefixed with `data: `, terminated by `data: [DONE]`
 *
 * Yields decoded chunks incrementally. Robust to partial lines across reads.
 */
export async function* parseChatStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Split on newlines; keep the trailing partial line in the buffer.
      let nlIndex: number;
      while ((nlIndex = buffer.indexOf('\n')) >= 0) {
        const rawLine = buffer.slice(0, nlIndex).trim();
        buffer = buffer.slice(nlIndex + 1);
        const chunk = decodeLine(rawLine);
        if (chunk) yield chunk;
      }
    }
    // Flush any final buffered line.
    const tail = buffer.trim();
    if (tail) {
      const chunk = decodeLine(tail);
      if (chunk) yield chunk;
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
  let payload = line;
  if (line.startsWith('data:')) {
    payload = line.slice(5).trim();
    if (payload === '[DONE]') return { done: true };
  }
  try {
    return JSON.parse(payload) as ChatStreamChunk;
  } catch {
    // Ignore non-JSON keepalive lines (`:` comments, blank SSE separators).
    return null;
  }
}

/** Extract the text delta from a chunk regardless of endpoint shape. */
export function chunkText(chunk: ChatStreamChunk): string {
  return chunk.message?.content ?? chunk.response ?? '';
}
