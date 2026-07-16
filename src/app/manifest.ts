import type { MetadataRoute } from 'next';

/**
 * PWA Web App Manifest — makes the app installable on mobile homescreens.
 * Served at /manifest.webmanifest (Next.js handles the routing).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ollama Chat — AI WebUI',
    short_name: 'AI Chat',
    description:
      'A fast, beautiful ChatGPT-style interface for your local Ollama models. Streaming, Markdown, LaTeX, code, and more.',
    start_url: '/',
    display: 'standalone',
    background_color: '#111111',
    theme_color: '#7C3AED',
    orientation: 'any',
    categories: ['productivity', 'utilities', 'ai'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
