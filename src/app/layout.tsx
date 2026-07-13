import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

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
  title: 'Ollama Chat — AI WebUI',
  description:
    'A fast, beautiful ChatGPT-style interface for your local Ollama models. Streaming, Markdown, LaTeX, code, and more.',
  applicationName: 'Ollama Chat',
  authors: [{ name: 'Ollama WebUI' }],
  keywords: ['ollama', 'ai', 'chat', 'llm', 'webui'],
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrains.variable} light`} suppressHydrationWarning>
      <body className="min-h-[100dvh] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
