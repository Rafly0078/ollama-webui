'use client';

import { AnimatePresence, m } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';

export function OfflineBanner() {
  const online = useOnlineStatus();
  return (
    <AnimatePresence>
      {!online && (
        <m.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed inset-x-0 top-0 z-[80] flex items-center justify-center gap-2 bg-error px-4 py-2 text-sm font-medium text-white"
          role="alert"
        >
          <WifiOff className="h-4 w-4" />
          You&apos;re offline. Reconnecting automatically when your connection returns…
        </m.div>
      )}
    </AnimatePresence>
  );
}
