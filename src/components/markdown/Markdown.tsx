'use client';

import { lazy, memo, Suspense } from 'react';

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

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <Suspense fallback={<PlainFallback content={content} />}>
      <MarkdownRenderer content={content} />
    </Suspense>
  );
});
