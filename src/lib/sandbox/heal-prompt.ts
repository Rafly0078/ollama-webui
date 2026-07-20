/**
 * Builds the messages sent to the model to fix code that errored in the
 * sandbox. The model is asked to return the corrected code as plain ```html /
 * ```css / ```js fences (a full rewrite), which extractWebSource can parse back
 * out on the next iteration. A full rewrite (rather than a codepatch diff) is
 * used here because the loop re-runs the whole document each pass, so it's the
 * simplest thing that reliably converges.
 */

import type { ApiChatMessage } from '@/lib/api/types';
import type { SandboxReport, WebSource } from './types';
import { sourceToBlocks } from './compose';

const HEAL_SYSTEM = `You are a meticulous front-end engineer fixing your own web code. You will be given the current HTML/CSS/JS and the exact runtime errors it produced when run in a browser sandbox. Fix every reported problem.

Rules:
- Return the COMPLETE corrected code, not a diff and not a description.
- Return it as separate fenced code blocks: one \`\`\`html block, and (only if used) one \`\`\`css block and one \`\`\`js block.
- Keep the original intent, layout, and features intact — change only what's needed to make it run cleanly.
- Do not add explanations, comments about the fix, or any prose outside the code blocks.
- Make sure the page actually renders visible content (no blank screen).`;

function formatIssues(report: SandboxReport): string {
  const lines: string[] = [];
  if (report.blank) {
    lines.push('- The page rendered a BLANK screen (nothing visible). Ensure content is actually shown.');
  }
  for (const issue of report.issues) {
    const label =
      issue.kind === 'error'
        ? 'Runtime error'
        : issue.kind === 'console-error'
          ? 'console.error'
          : issue.kind === 'console-warn'
            ? 'console.warn'
            : 'Render';
    lines.push(`- [${label}] ${issue.message}`);
  }
  return lines.join('\n');
}

/** Compose the chat messages for one heal iteration. */
export function buildHealMessages(src: WebSource, report: SandboxReport): ApiChatMessage[] {
  return [
    { role: 'system', content: HEAL_SYSTEM },
    {
      role: 'user',
      content: `The following code was run in a sandbox and produced errors.

CURRENT CODE:
${sourceToBlocks(src)}

PROBLEMS OBSERVED:
${formatIssues(report)}

Return the full corrected code now.`,
    },
  ];
}
