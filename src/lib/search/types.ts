/**
 * Web-search types. Provider-agnostic on purpose: the app only ever sees
 * `SearchResult` / `SearchResponse`, so swapping Tavily for another backend is
 * a change to the route + client, never the UI.
 */

/** A single retrieved web result. */
export interface SearchResult {
  title: string;
  url: string;
  /** Short snippet the provider returns for the result. */
  snippet: string;
  /** Cleaned page text when the provider fetched it (may be absent/empty). */
  content?: string;
  /** Provider relevance score in [0,1] when available. */
  score?: number;
}

/** Normalized response returned by /api/search. */
export interface SearchResponse {
  query: string;
  /** Provider's direct answer when it offers one (Tavily `answer`). */
  answer?: string;
  results: SearchResult[];
}

/** A compact citation stored on an assistant message for display. */
export interface Source {
  title: string;
  url: string;
}
