import type { Message } from '@/types';
import type { ApiChatMessage } from '@/lib/api/types';

/**
 * Agentic web-search planning. Before searching, the model decides WHAT to
 * search for: the concrete keyword queries and the underlying goal. This turns
 * a raw user message ("kenapa build-ku lambat?") into targeted queries
 * ("next.js slow build cache", "webpack build performance 2026") instead of
 * dumping the whole sentence at the search provider.
 *
 * Pure module — no network, no React. The caller runs the actual chat/search.
 */

/** A search plan produced by the model (or the fallback). */
export interface SearchPlan {
  /** Why we're searching — kept for display and to steer the final answer. */
  goal: string;
  /** Concrete queries to run against the search provider, in priority order. */
  queries: string[];
}

/** Cap on planned queries — more than this wastes provider calls + context. */
const MAX_QUERIES = 3;

/**
 * Build the message list for the planning turn. We ask for a strict JSON
 * object; recent conversation turns are included as light context so the plan
 * can resolve pronouns / follow-ups ("and the second one?").
 */
export function buildPlanMessages(userText: string, history: Message[]): ApiChatMessage[] {
  // A few recent turns for context — enough to disambiguate, not the whole log.
  const recent = history
    .filter((m) => m.role !== 'system' && !m.error && m.content.trim())
    .slice(-4)
    .map<ApiChatMessage>((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const system: ApiChatMessage = {
    role: 'system',
    content:
      `You are a search-planning assistant. Given the user's request, decide what to look up on the web to answer it well.\n\n` +
      `Respond with ONLY a JSON object, no prose, no code fence:\n` +
      `{"goal": "<one sentence: what we're trying to find out>", "queries": ["<search query 1>", "<search query 2>"]}\n\n` +
      `Rules:\n` +
      `- "queries" are the actual keyword strings to type into a search engine — concise, specific, no full sentences.\n` +
      `- Give 1 to ${MAX_QUERIES} queries. Use more than one only when the request has distinct parts worth searching separately.\n` +
      `- Prefer recent, specific terms. Add a year only when recency matters.\n` +
      `- Do not answer the question. Only plan the search.`,
  };

  return [system, ...recent, { role: 'user', content: userText }];
}

/**
 * Parse the model's planning output into a SearchPlan. Tolerant of the ways
 * weaker local models wrap JSON: leading prose, ```json fences, trailing text.
 * Returns null when nothing usable is found so the caller can fall back.
 */
export function parsePlan(raw: string): SearchPlan | null {
  const obj = extractJsonObject(raw);
  if (!obj) return null;

  const cleaned = Array.isArray(obj.queries)
    ? obj.queries
        .filter((q): q is string => typeof q === 'string')
        .map((q) => q.trim())
        .filter(Boolean)
    : [];

  // Dedupe case-insensitively (preserving order) BEFORE capping, so duplicate
  // queries don't eat into the cap and leave us with fewer distinct searches.
  const seen = new Set<string>();
  const queries = cleaned
    .filter((q) => {
      const key = q.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_QUERIES);

  if (queries.length === 0) return null;

  const goal = typeof obj.goal === 'string' ? obj.goal.trim() : '';
  return { goal, queries };
}

/**
 * Build a plan without the model — used as a fallback when planning fails or
 * thinking is unavailable. Searching the raw user text is exactly the old
 * (pre-agentic) behavior, so this never regresses.
 */
export function fallbackPlan(userText: string): SearchPlan {
  return { goal: '', queries: [userText.trim()].filter(Boolean) };
}

/** Find and JSON-parse the first balanced `{…}` object in a string. */
function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const slice = text.slice(start, i + 1);
        try {
          const parsed = JSON.parse(slice);
          return typeof parsed === 'object' && parsed !== null
            ? (parsed as Record<string, unknown>)
            : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
