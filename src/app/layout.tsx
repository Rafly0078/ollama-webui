import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://ollama-chat.vercel.app'),
  title: 'Ollama Chat — AI WebUI',
  description:
    'A fast, beautiful ChatGPT-style interface for your local Ollama models. Streaming, Markdown, LaTeX, code, and more.',
  applicationName: 'Ollama Chat',
  authors: [{ name: 'Ollama WebUI' }],
  keywords: ['ollama', 'ai', 'chat', 'llm', 'webui', 'local ai', 'private ai'],
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ollama-chat.vercel.app',
    title: 'Ollama Chat — AI WebUI',
    description:
      'A fast, beautiful ChatGPT-style interface for your local Ollama models. Streaming, Markdown, LaTeX, code, and more.',
    siteName: 'Ollama Chat',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ollama Chat — AI WebUI',
    description:
      'A fast, beautiful ChatGPT-style interface for your local Ollama models. Streaming, Markdown, LaTeX, code, and more.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff9e8' },
    { media: '(prefers-color-scheme: dark)', color: '#1f1d1b' },
  ],
};

/**
 * Runs before first paint to set the theme class from persisted settings,
 * eliminating the light-theme flash on reload for users on dark/system. Mirrors
 * ThemeManager's resolution so the two never disagree. Kept dependency-free and
 * inlined; any throw is swallowed so a corrupt store can't block rendering.
 */
const NO_FLASH_THEME = `(function(){try{var t='light';var raw=localStorage.getItem('ollama-webui:settings');if(raw){var s=JSON.parse(raw);t=(s&&s.state&&s.state.theme)||'light';}var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.classList.toggle('light',!d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrains.variable} light`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME }} />
      </head>
      <body className="min-h-[100dvh] antialiased">
        <ServiceWorkerRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
