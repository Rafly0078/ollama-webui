/**
 * Headless sandbox runner. Mounts a hidden, locked-down iframe, loads a
 * composed document via `srcdoc`, collects the errors its bootstrap posts back,
 * and resolves a SandboxReport once the page signals "done" (or a timeout
 * fires). Browser-only — must run in the DOM, never on the server.
 *
 * The iframe uses `sandbox="allow-scripts"` WITHOUT `allow-same-origin`, so the
 * guest code runs in an opaque origin: it can execute scripts but cannot reach
 * this app's cookies, localStorage, or DOM. postMessage is the only channel.
 */

import { buildBootstrap, SANDBOX_CHANNEL } from './bootstrap';
import { composeDocument } from './compose';
import type { SandboxIssue, SandboxReport, WebSource } from './types';
import { uid } from '@/lib/utils/id';

const RUN_TIMEOUT_MS = 8000;

/**
 * Run `src` in a throwaway hidden iframe and resolve its report. When an
 * `iframe` is provided (the visible preview), that element is reused so the
 * user sees exactly what was audited; otherwise a hidden one is created and
 * removed on completion.
 */
export function runSandbox(
  src: WebSource,
  opts?: { iframe?: HTMLIFrameElement; signal?: AbortSignal },
): Promise<SandboxReport> {
  return new Promise((resolve) => {
    const runId = uid();
    const bootstrap = buildBootstrap(runId);
    const doc = composeDocument(src, bootstrap);
    const issues: SandboxIssue[] = [];

    const owned = !opts?.iframe;
    const iframe = opts?.iframe ?? document.createElement('iframe');
    if (owned) {
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText =
        'position:fixed;left:-99999px;top:0;width:1024px;height:768px;border:0;visibility:hidden;';
      document.body.appendChild(iframe);
    }
    iframe.setAttribute('sandbox', 'allow-scripts');

    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      opts?.signal?.removeEventListener('abort', onAbort);
      clearTimeout(timer);
      if (owned) iframe.remove();
    };

    const finish = (blank: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ issues, blank });
    };

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as
        | { __ch?: string; runId?: string; type?: string; payload?: unknown }
        | undefined;
      if (!data || data.__ch !== SANDBOX_CHANNEL || data.runId !== runId) return;
      if (data.type === 'issue') {
        issues.push(data.payload as SandboxIssue);
      } else if (data.type === 'done') {
        const payload = data.payload as { blank?: boolean } | undefined;
        finish(Boolean(payload?.blank));
      }
    };

    const onAbort = () => finish(false);

    window.addEventListener('message', onMessage);
    opts?.signal?.addEventListener('abort', onAbort, { once: true });

    // Safety net: if the page never fires "done" (e.g. a script hangs before
    // load), resolve with whatever issues were captured so the loop can't stall.
    const timer = setTimeout(() => finish(false), RUN_TIMEOUT_MS);

    iframe.srcdoc = doc;
  });
}
