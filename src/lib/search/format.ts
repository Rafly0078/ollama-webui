import type { SearchResponse, SearchResult, Source } from './types';

/**
 * Token budget for the search context block we inject into the prompt. Local
 * models have small context windows, so we cap how much raw page text rides
 * along — enough to answer well, not so much it evicts the conversation.
 */
const MAX_CONTENT_CHARS_PER_RESULT = 1500;
const MAX_RESULTS_IN_CONTEXT = 5;

/**
 * Build the system-visible context block from search results. Numbered so the
 * model can cite as [1], [2], … which we map back to sources for display.
 * Prefers cleaned page `content`; falls back to the snippet.
 */
export function formatSearchContext(res: SearchResponse): string {
  const lines: string[] = [
    `Web search results for: "${res.query}"`,
    'Use these to answer. Cite sources inline as [1], [2], etc. matching the numbers below.',
    'If the results do not answer the question, say so instead of guessing.',
    '',
  ];

  if (res.answer?.trim()) {
    lines.push(`Provider summary: ${res.answer.trim()}`, '');
  }

  res.results.slice(0, MAX_RESULTS_IN_CONTEXT).forEach((r, i) => {
    const body = (r.content?.trim() || r.snippet.trim()).slice(0, MAX_CONTENT_CHARS_PER_RESULT);
    lines.push(`[${i + 1}] ${r.title}`, r.url, body, '');
  });

  return lines.join('\n').trim();
}

/** Compact citations to persist on the assistant message for the UI. */
export function toSources(res: SearchResponse): Source[] {
  return res.results
    .slice(0, MAX_RESULTS_IN_CONTEXT)
    .map((r: SearchResult) => ({ title: r.title, url: r.url }));
}
