'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Auto-scroll behaviour for chat: sticks to the bottom while the user is near
 * the bottom, but stops following if they scroll up to read history. Exposes a
 * `scrollToBottom` action and an `atBottom` flag for the scroll-to-bottom FAB.
 */
export function useAutoScroll<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const stick = useRef(true);

  const threshold = 120;

  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance < threshold;
    stick.current = near;
    setAtBottom(near);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    stick.current = true;
    setAtBottom(true);
  }, []);

  // Follow new content only when the user is already pinned to the bottom.
  useEffect(() => {
    if (stick.current) {
      const el = ref.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);

  return { ref, atBottom, scrollToBottom, handleScroll };
}
