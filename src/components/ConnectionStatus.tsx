'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { ping } from '@/lib/api/client';
import { apiConfigured } from '@/lib/api/config';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { cn } from '@/lib/utils/cn';

type Status = 'checking' | 'online' | 'offline' | 'unconfigured';

/**
 * Live API health dot. Polls the API periodically and auto-reconnects with
 * backoff when it goes down; pauses polling while the browser is offline.
 */
export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>('checking');
  const online = useOnlineStatus();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempts = useRef(0);

  const check = useCallback(async () => {
    if (!apiConfigured()) {
      setStatus('unconfigured');
      return;
    }
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    setStatus((s) => (s === 'online' ? s : 'checking'));
    const ok = await ping();
    setStatus(ok ? 'online' : 'offline');
    attempts.current = ok ? 0 : attempts.current + 1;

    // Backoff: 5s when healthy, growing to 30s max while retrying.
    const delay = ok ? 20_000 : Math.min(5_000 * 2 ** (attempts.current - 1), 30_000);
    timer.current = setTimeout(check, delay);
  }, []);

  useEffect(() => {
    void check();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [check]);

  // Re-check immediately when the browser comes back online.
  useEffect(() => {
    if (online) {
      attempts.current = 0;
      void check();
    } else {
      setStatus('offline');
    }
  }, [online, check]);

  const config = {
    checking: { color: 'bg-amber-400', label: 'Checking connection…' },
    online: { color: 'bg-emerald-400', label: 'Connected to API' },
    offline: { color: 'bg-rose-500', label: 'API unreachable — retrying…' },
    unconfigured: { color: 'bg-content-subtle', label: 'API URL not configured' },
  }[status];

  return (
    <Tooltip label={config.label} side="bottom">
      <button
        onClick={() => {
          attempts.current = 0;
          void check();
        }}
        className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-white/5"
        aria-label={config.label}
      >
        <span className="relative flex h-2.5 w-2.5">
          {status === 'checking' && (
            <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', config.color)} />
          )}
          <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', config.color)} />
        </span>
      </button>
    </Tooltip>
  );
}
