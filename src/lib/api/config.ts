/**
 * Central API configuration. The base URL comes from the environment and is
 * never hardcoded to localhost. A runtime override (set from Settings) can
 * replace it per-browser without a rebuild.
 */

/** Build-time endpoint from the environment. Shown in the UI for reference. */
export const API_BASE_URL: string = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

// Optional per-browser override, injected by the settings layer after hydration.
let runtimeOverride: string | null = null;

/** Set/clear the runtime API URL override (called from ThemeManager). */
export function setApiOverride(url: string | null): void {
  runtimeOverride = url && url.trim() ? url.trim().replace(/\/+$/, '') : null;
}

/** The endpoint actually used for requests: override wins, else the env value. */
export function getApiBase(): string {
  return runtimeOverride || API_BASE_URL;
}

export const DEFAULT_TIMEOUT_MS = 30_000;
/** Streaming has no fixed length; use a longer idle guard instead. */
export const STREAM_IDLE_TIMEOUT_MS = 120_000;

export function apiConfigured(): boolean {
  const base = getApiBase();
  return Boolean(base) && !/localhost|127\.0\.0\.1/i.test(base);
}

/** Build a full URL for an API path (path should start with `/api/...`). */
export function apiUrl(path: string): string {
  const base = getApiBase();
  if (!base) {
    throw new ApiError(
      'NEXT_PUBLIC_API_URL is not set. Add it to your environment (see .env.example).',
      { kind: 'config' },
    );
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export type ApiErrorKind =
  | 'config'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'http'
  | 'parse'
  | 'unknown';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  constructor(message: string, opts: { kind: ApiErrorKind; status?: number } = { kind: 'unknown' }) {
    super(message);
    this.name = 'ApiError';
    this.kind = opts.kind;
    this.status = opts.status;
  }

  static from(err: unknown): ApiError {
    if (err instanceof ApiError) return err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      return new ApiError('Request was cancelled.', { kind: 'aborted' });
    }
    if (err instanceof TypeError) {
      // fetch throws TypeError on network/CORS failures.
      return new ApiError(
        'Could not reach the API. Check your connection, the API URL, and CORS on the server.',
        { kind: 'network' },
      );
    }
    return new ApiError(err instanceof Error ? err.message : 'Unknown error', { kind: 'unknown' });
  }

  get userMessage(): string {
    switch (this.kind) {
      case 'config':
        return this.message;
      case 'network':
        return 'Connection failed. The API server may be offline or blocking this origin (CORS).';
      case 'timeout':
        return 'The request timed out. The server took too long to respond.';
      case 'aborted':
        return 'Generation stopped.';
      case 'http':
        return `The server returned an error${this.status ? ` (${this.status})` : ''}: ${this.message}`;
      default:
        return this.message || 'Something went wrong.';
    }
  }
}
