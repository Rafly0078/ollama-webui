'use client';

import { useEffect, useState } from 'react';

/**
 * Zustand's persist middleware hydrates from localStorage after mount. Reading
 * persisted state during SSR/first paint causes hydration mismatches, so gate
 * client-only content on this flag.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
