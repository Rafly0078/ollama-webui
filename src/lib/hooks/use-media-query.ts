'use client';

import { useEffect, useState } from 'react';

/** Reactive media query hook (SSR-safe: defaults to false on the server). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);

  return matches;
}

export const useIsMobile = () => useMediaQuery('(max-width: 768px)');
export const usePrefersReducedMotion = () =>
  useMediaQuery('(prefers-reduced-motion: reduce)');
