'use client';

import { m } from 'framer-motion';
import { PROMPT_SUGGESTIONS } from '@/lib/store/defaults';

const PROMPT_CARD_TONES = ['prompt-card-paper', 'prompt-card-coral', 'prompt-card-sun', 'prompt-card-sky'];

export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="chat-container flex min-h-full flex-col justify-center py-8 text-left sm:py-12">
      <m.div
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="accent-gradient mb-7 flex h-16 w-16 items-center justify-center rounded-md border-[3px] border-border shadow-card"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/noun-heart-8300361 (1).png" alt="" width={24} height={24} className="h-6 w-6" />
      </m.div>
      <m.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="max-w-5xl text-4xl font-bold uppercase leading-[0.94] tracking-[-0.06em] text-content sm:text-6xl"
      >
        What will we make today?
      </m.h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-content-muted">
        Your models. Your machine. Your private workspace for asking, making, and figuring things out.
      </p>

      <div className="mt-10 grid w-full grid-flow-dense gap-4 sm:grid-cols-2">
        {PROMPT_SUGGESTIONS.map((s, i) => (
          <m.button
            key={s.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            whileHover={{ y: -2 }}
            whileTap={{ x: 2, y: 2 }}
            onClick={() => onPick(s.prompt)}
            className={`glass focus-ring group min-h-32 rounded-md p-5 text-left shadow-card transition-transform hover:-translate-x-1 hover:-translate-y-1 active:translate-x-0.5 active:translate-y-0.5 ${PROMPT_CARD_TONES[i]}`}
          >
            <p className="text-lg font-bold uppercase tracking-[-0.04em] text-content group-hover:text-accent">
              {s.title}
            </p>
            <p className="mt-2 max-w-[25ch] text-sm leading-5 text-content-muted">{s.subtitle}</p>
          </m.button>
        ))}
      </div>
    </div>
  );
}
