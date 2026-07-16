/**
 * Ollama Chat — Service Worker
 *
 * A minimal, non-intercepting SW whose sole purpose is to satisfy the PWA
 * installability criteria (Chrome requires a SW with a fetch handler). It
 * does NOT cache anything — this is a client-side SPA that talks to a
 * remote Ollama API, so offline caching would only cause confusion (stale
 * model lists, failed chat requests served from cache, etc.).
 *
 * The fetch handler passes all requests straight through to the network.
 * If the app later gains true offline capabilities (e.g. caching static
 * assets for a splash screen), this is where that logic would go.
 */

const SW_VERSION = 'ollama-chat-v1';

self.addEventListener('install', (event) => {
  // Skip waiting so the SW activates immediately on first install.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim clients so the SW controls the page immediately.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through: every request goes to the network as normal.
  // This handler exists solely to meet the PWA installability requirement.
  event.respondWith(fetch(event.request));
});
