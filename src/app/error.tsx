'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/ErrorScreen';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface unexpected render errors for debugging.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <ErrorScreen
        title="Unexpected error"
        message={error.message || 'The app hit an unexpected error. Try reloading.'}
        onRetry={reset}
      />
    </div>
  );
}
