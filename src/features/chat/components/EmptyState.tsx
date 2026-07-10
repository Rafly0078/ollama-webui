'use client';

import { m } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { PROMPT_SUGGESTIONS } from '@/lib/store/defaults';

export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="chat-container flex h-full flex-col items-center justify-center py-10 text-center">
      <m.div
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="accent-gradient mb-6 flex h-16 w-16 items-center justify-center rounded-2xl shadow-subtle"
      >
        <Sparkles className="h-8 w-8 text-accent-fg" />
      </m.div>
      <m.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-gradient-to-b from-content to-content-muted bg-clip-text text-3xl font-semibold text-transparent sm:text-4xl"
      >
        How can I help you today?
      </m.h1>
      <p className="mt-3 max-w-md text-content-muted">
        Ask anything. Your models, your machine, your data — nothing leaves your Ollama server.
      </p>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {PROMPT_SUGGESTIONS.map((s, i) => (
          <m.button
            key={s.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            whileHover={{ y: -2 }}
            onClick={() => onPick(s.prompt)}
            className="glass focus-ring group rounded-2xl p-4 text-left transition-colors hover:border-accent/40"
          >
            <p className="font-medium text-content group-hover:text-accent">{s.title}</p>
            <p className="mt-1 text-sm text-content-muted">{s.subtitle}</p>
          </m.button>
        ))}
      </div>
    </div>
  );
}
