'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (/sw.js) on the client after the page loads.
 * The SW is a pass-through (no caching) — it exists solely to make the app
 * meet the PWA installability criteria. Registration is deferred to
 * `onload` so it never blocks first paint or TTI.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return; // skip in dev to avoid HMR issues

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failure is non-fatal — the app still works as a
        // normal website; only installability is affected.
      });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
