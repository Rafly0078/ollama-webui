/**
 * Artifact directive detection. The assistant produces documents by emitting a
 * fenced block tagged `artifact` containing a JSON GenerateRequest:
 *
 *   ```artifact
 *   { "tool": "create_pdf", "name": "report.pdf", "title": "...", "content": "# ..." }
 *   ```
 *
 * We extract those, validate the tool name, and return the requests plus the
 * message text with the raw blocks removed (the UI renders an ArtifactCard in
 * their place). Robust to malformed JSON — a bad block is left inline as code.
 */

import type { GenerateRequest } from './types';
import { isToolName } from './registry';

const FENCE = /```artifact\s*\n([\s\S]*?)```/g;

export interface DetectResult {
  /** Valid generation requests found in the text. */
  requests: GenerateRequest[];
  /** Text with recognized artifact blocks stripped. */
  cleaned: string;
  /** True if any directive (valid or not) was present. */
  found: boolean;
}

export function detectArtifacts(text: string): DetectResult {
  if (!text || !text.includes('```artifact')) {
    return { requests: [], cleaned: text, found: false };
  }

  const requests: GenerateRequest[] = [];
  let found = false;

  const cleaned = text.replace(FENCE, (whole, body: string) => {
    found = true;
    try {
      const parsed = JSON.parse(body.trim()) as GenerateRequest;
      if (parsed && typeof parsed.tool === 'string' && isToolName(parsed.tool)) {
        requests.push(parsed);
        return ''; // strip recognized directive from display
      }
    } catch {
      /* fall through — keep the block visible so nothing is silently lost */
    }
    return whole;
  });

  return { requests, cleaned: cleaned.trim(), found };
}

/** True when a (possibly still-streaming) text contains a complete directive. */
export function hasCompleteDirective(text: string): boolean {
  FENCE.lastIndex = 0;
  return FENCE.test(text);
}
