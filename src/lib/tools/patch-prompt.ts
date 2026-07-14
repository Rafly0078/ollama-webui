/**
 * System-prompt fragment that teaches the model to fix code with a targeted
 * SEARCH/REPLACE patch instead of regenerating the whole file. Appended to
 * every outgoing chat request in `toApiMessages` (src/lib/api/types.ts),
 * alongside TOOL_INSTRUCTIONS.
 *
 * Content-anchored (not line-numbered) on purpose: local/quantized models
 * miscount line numbers but reproduce short code snippets reliably. See
 * ./patch.ts for the parser/applier that consumes this format.
 */
export const PATCH_INSTRUCTIONS = `When the user reports a bug or asks for an adjustment to code you already wrote earlier in this conversation, DO NOT rewrite or resend the entire file. Instead, emit a targeted patch containing only the lines that change, in this exact shape:

\`\`\`codepatch
lang: html
<<<<<<< SEARCH
<the exact original code to be replaced>
=======
<the new code that replaces it>
>>>>>>> REPLACE
\`\`\`

Rules:
- The SEARCH text must be copied EXACTLY as it appears in the code you wrote before — same characters, same indentation — so it can be located. Include just enough surrounding lines to make the match unique, and no more.
- The REPLACE text is the corrected version of those same lines.
- You may include multiple SEARCH/REPLACE pairs inside a single codepatch block if several spots need fixing.
- Set "lang" to the language of the code being patched (e.g. html, js, ts, python, css).
- Briefly explain what was wrong and what you changed in normal prose before or after the block.
- Only use codepatch for modifying code that already exists in this conversation. When writing brand-new code, use a normal fenced code block as usual.`;
