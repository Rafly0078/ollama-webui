import 'server-only';

/**
 * Local AI Bridge configuration. The bridge is the ONLY component that talks to
 * Ollama; the frontend calls /api/bridge/* and never sees this URL. Swapping to
 * a remote inference server later means changing only this target + the fetchers
 * in ./ollama.ts — no frontend changes.
 *
 * Target resolution order:
 *   1. OLLAMA_API_URL           (server-only, preferred — hidden from the client)
 *   2. NEXT_PUBLIC_API_URL      (legacy; kept so existing deploys keep working)
 */
export function getBridgeTarget(): string {
  const raw = process.env.OLLAMA_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
  return raw.replace(/\/+$/, '');
}

export function bridgeConfigured(): boolean {
  return Boolean(getBridgeTarget());
}

export class BridgeError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'BridgeError';
    this.status = status;
  }
}
