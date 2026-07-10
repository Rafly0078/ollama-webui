import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
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
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} dark`} suppressHydrationWarning>
      <body className="min-h-[100dvh] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
