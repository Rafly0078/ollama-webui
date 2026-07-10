'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastCtx {
  toast: (message: string, kind?: ToastKind) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = ++counter.current;
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        role="status"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icons[t.kind];
            return (
              <m.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="popover pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl px-4 py-3 shadow-card"
              >
                <Icon
                  className={
                    t.kind === 'success'
                      ? 'mt-0.5 h-5 w-5 shrink-0 text-success'
                      : t.kind === 'error'
                        ? 'mt-0.5 h-5 w-5 shrink-0 text-error'
                        : 'mt-0.5 h-5 w-5 shrink-0 text-accent'
                  }
                />
                <p className="text-sm text-content">{t.message}</p>
                <button
                  onClick={() => remove(t.id)}
                  className="ml-1 rounded-md p-0.5 text-content-subtle hover:text-content"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
