import type { ModelInfo } from '@/types';
import { ApiError, DEFAULT_TIMEOUT_MS, apiUrl } from './config';
import { parseChatStream } from './stream';
import type {
  ChatRequest,
  ChatStreamChunk,
  ModelsResponse,
  RawModel,
} from './types';

/** Combine an external signal with an internal timeout. */
function withTimeout(ms: number, external?: AbortSignal): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), ms);
  const onAbort = () => ctrl.abort(external?.reason);
  if (external) {
    if (external.aborted) ctrl.abort(external.reason);
    else external.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    cancel: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    },
  };
}

async function assertOk(res: Response): Promise<void> {
  if (res.ok) return;
  let detail = res.statusText;
  try {
    const text = await res.text();
    if (text) {
      try {
        const j = JSON.parse(text) as { error?: string };
        detail = j.error ?? text;
      } catch {
        detail = text;
      }
    }
  } catch {
    /* ignore */
  }
  throw new ApiError(detail, { kind: 'http', status: res.status });
}

function mapModel(raw: RawModel): ModelInfo {
  const name = raw.name ?? raw.model ?? 'unknown';
  const d = raw.details ?? {};
  const caps = raw.capabilities ?? [];
  return {
    name,
    label: name.replace(/:latest$/, ''),
    size: raw.size,
    contextLength: raw.context_length,
    details: {
      family: d.family ?? d.families?.[0],
      parameterSize: d.parameter_size,
      quantizationLevel: d.quantization_level,
      format: d.format,
    },
    supportsVision:
      caps.includes('vision') ||
      /vision|llava|bakllava|moondream|llama3\.2-vision/i.test(name),
  };
}

/** GET /api/models — list installed models. */
const API_TAG_PATHS = ['/api/tags', '/api/models'];
const API_CHAT_PATHS = ['/api/chat', '/api/chat/stream'];

async function fetchWithFallback(
  paths: string[],
  init: RequestInit,
): Promise<{ res: Response; usedPath: string }> {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      const res = await fetch(apiUrl(path), init);
      if (res.ok) return { res, usedPath: path };
      if (res.status === 404 || res.status === 405) {
        lastError = new ApiError(`Endpoint ${path} returned ${res.status}.`, {
          kind: 'http',
          status: res.status,
        });
        continue;
      }
      return { res, usedPath: path };
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new ApiError('Unable to reach any API route.', { kind: 'network' });
}

export async function fetchModels(signal?: AbortSignal): Promise<ModelInfo[]> {
  const { signal: s, cancel } = withTimeout(DEFAULT_TIMEOUT_MS, signal);
  try {
    const { res } = await fetchWithFallback(API_TAG_PATHS, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: s,
    });
    await assertOk(res);
    const data = (await res.json()) as ModelsResponse | RawModel[];
    const list = Array.isArray(data) ? data : data.models ?? [];
    return list.map(mapModel).sort((a, b) => a.label.localeCompare(b.label));
  } catch (err) {
    throw normalize(err);
  } finally {
    cancel();
  }
}

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onDone: (final: ChatStreamChunk) => void;
}

/**
 * POST /api/chat/stream — stream a chat completion.
 * Returns when the stream ends or is aborted. Deltas are pushed via handlers.
 */
export async function streamChat(
  req: ChatRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    const result = await fetchWithFallback(API_CHAT_PATHS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson, text/event-stream' },
      body: JSON.stringify({ ...req, stream: true }),
      signal,
    });
    res = result.res;
  } catch (err) {
    throw normalize(err);
  }

  await assertOk(res);
  if (!res.body) throw new ApiError('The server did not return a stream body.', { kind: 'parse' });

  let final: ChatStreamChunk = {};
  try {
    for await (const chunk of parseChatStream(res.body, signal)) {
      if (chunk.error) throw new ApiError(chunk.error, { kind: 'http', status: res.status });
      const delta = chunk.message?.content ?? chunk.response ?? '';
      if (delta) handlers.onDelta(delta);
      if (chunk.done) final = { ...final, ...chunk };
    }
  } catch (err) {
    throw normalize(err);
  }
  handlers.onDone(final);
}

/** POST /api/chat — non-streaming completion (used for auto-title generation). */
export async function chat(req: ChatRequest, signal?: AbortSignal): Promise<string> {
  const { signal: s, cancel } = withTimeout(DEFAULT_TIMEOUT_MS, signal);
  try {
    const { res } = await fetchWithFallback(API_CHAT_PATHS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req, stream: false }),
      signal: s,
    });
    await assertOk(res);
    const data = (await res.json()) as ChatStreamChunk;
    return data.message?.content ?? data.response ?? '';
  } catch (err) {
    throw normalize(err);
  } finally {
    cancel();
  }
}

/** Lightweight connectivity probe for the status indicator. */
export async function ping(signal?: AbortSignal): Promise<boolean> {
  const { signal: s, cancel } = withTimeout(8000, signal);
  try {
    const { res } = await fetchWithFallback(API_TAG_PATHS, { method: 'GET', signal: s });
    return res.ok;
  } catch {
    return false;
  } finally {
    cancel();
  }
}

function normalize(err: unknown): ApiError {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return new ApiError('The request timed out.', { kind: 'timeout' });
  }
  return ApiError.from(err);
}
