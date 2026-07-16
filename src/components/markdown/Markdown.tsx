'use client';

import { lazy, memo, Suspense, useEffect, useRef, useState } from 'react';

/**
 * Lazy markdown boundary. The heavy renderer (react-markdown, remark/rehype,
 * KaTeX, highlight.js + their CSS) is code-split and only fetched the first time
 * a message needs rich rendering — it never touches the initial bundle or FCP.
 *
 * While the chunk loads, the Suspense fallback shows the same text with matching
 * typography/whitespace, so first paint is instant and nothing shifts when the
 * renderer swaps in. Once resolved it stays mounted (no re-suspense on streaming
 * prop changes).
 */
const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'));

function PlainFallback({ content }: { content: string }) {
  return <div className="prose-chat whitespace-pre-wrap break-words">{content}</div>;
}

/**
 * Gate rich rendering on visibility. `content-visibility: auto` skips layout and
 * paint for offscreen messages, but NOT JavaScript — without this, mounting a
 * long conversation runs react-markdown + highlight.js synchronously for every
 * message at once (dozens of blocks), which drops frames on load. Here each
 * message renders as plain text until it scrolls near the viewport, then
 * upgrades to the full renderer. The upgrade is one-way: once a message has been
 * seen it stays rich, so scrolling back and forth never re-parses or churns.
 *
 * Streaming messages skip the gate entirely — they're always on screen and must
 * render live.
 */
function useHasBeenVisible(streaming: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(streaming);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    // No IntersectionObserver (old browsers / SSR edge) → render rich now.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Start rendering a bit before the message enters view so the upgrade
      // isn't visible to the user as a swap.
      { rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return { ref, visible };
}

export const Markdown = memo(function Markdown({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  const { ref, visible } = useHasBeenVisible(streaming === true);

  if (!visible) {
    return (
      <div ref={ref}>
        <PlainFallback content={content} />
      </div>
    );
  }

  return (
    <Suspense fallback={<PlainFallback content={content} />}>
      <MarkdownRenderer content={content} streaming={streaming} />
    </Suspense>
  );
});
