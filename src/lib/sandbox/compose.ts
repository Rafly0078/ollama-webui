/**
 * Turn a model message (or raw code) into a single runnable HTML document for
 * the sandbox iframe, and detect whether a message even contains runnable web
 * code in the first place.
 *
 * Pure and browser-safe — no DOM access, no server-only imports.
 */

import { extractCodeBlocks } from '@/lib/tools/patch';
import type { WebSource } from './types';

const HTML_LANGS = new Set(['html', 'htm', 'xhtml']);
const CSS_LANGS = new Set(['css']);
const JS_LANGS = new Set(['js', 'javascript', 'jsx', 'mjs']);

/**
 * Extract the runnable web parts from a message's code blocks. Multiple CSS/JS
 * blocks are concatenated in document order. Returns null when there is nothing
 * runnable (no HTML and no JS — CSS alone can't render anything meaningful).
 */
export function extractWebSource(message: string): WebSource | null {
  const blocks = extractCodeBlocks(message);
  if (blocks.length === 0) return null;

  const htmlParts: string[] = [];
  const cssParts: string[] = [];
  const jsParts: string[] = [];

  for (const b of blocks) {
    const lang = (b.lang ?? '').toLowerCase();
    if (HTML_LANGS.has(lang)) htmlParts.push(b.code);
    else if (CSS_LANGS.has(lang)) cssParts.push(b.code);
    else if (JS_LANGS.has(lang)) jsParts.push(b.code);
    else if (!lang && looksLikeHtml(b.code)) htmlParts.push(b.code);
  }

  const html = htmlParts.join('\n');
  const css = cssParts.join('\n\n');
  const js = jsParts.join('\n\n');

  // Runnable only if there's markup to render or a script to execute. A page
  // that is CSS-only has nothing to audit against.
  if (!html && !js) return null;

  return { html, css, js };
}

/** True if the message contains at least one runnable web code block. */
export function hasRunnableWeb(message: string): boolean {
  return extractWebSource(message) !== null;
}

/** Heuristic: does this untagged block look like HTML markup? */
function looksLikeHtml(code: string): boolean {
  return /<\s*(!doctype|html|body|div|section|main|h[1-6]|p|span|ul|table|canvas|svg)\b/i.test(
    code,
  );
}

/** True when the HTML is already a complete document we should not re-wrap. */
function isFullDocument(html: string): boolean {
  return /<\s*html[\s>]/i.test(html) || /<!doctype/i.test(html);
}

/**
 * Compose a single self-contained HTML document from a WebSource. When the HTML
 * is already a full document, CSS/JS are injected before </head> and </body>
 * respectively; otherwise the fragment is wrapped in a minimal shell. The
 * `bootstrap` script (error-capture wiring) is injected as the FIRST thing in
 * <head> so it catches errors thrown by the page's own scripts.
 */
export function composeDocument(src: WebSource, bootstrap: string): string {
  const styleTag = src.css ? `<style>\n${src.css}\n</style>` : '';
  const scriptTag = src.js ? `<script>\n${src.js}\n</script>` : '';
  const bootstrapTag = `<script>\n${bootstrap}\n</script>`;

  if (isFullDocument(src.html)) {
    let doc = src.html;
    // Bootstrap first, right after <head> (or after <html>, or prepended).
    if (/<\s*head[\s>]/i.test(doc)) {
      doc = doc.replace(/(<\s*head[^>]*>)/i, `$1\n${bootstrapTag}`);
    } else if (/<\s*html[^>]*>/i.test(doc)) {
      doc = doc.replace(/(<\s*html[^>]*>)/i, `$1\n<head>${bootstrapTag}</head>`);
    } else {
      doc = `${bootstrapTag}\n${doc}`;
    }
    if (styleTag) {
      doc = /<\/\s*head\s*>/i.test(doc)
        ? doc.replace(/<\/\s*head\s*>/i, `${styleTag}\n</head>`)
        : `${styleTag}\n${doc}`;
    }
    if (scriptTag) {
      doc = /<\/\s*body\s*>/i.test(doc)
        ? doc.replace(/<\/\s*body\s*>/i, `${scriptTag}\n</body>`)
        : `${doc}\n${scriptTag}`;
    }
    return doc;
  }

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${bootstrapTag}
${styleTag}
</head>
<body>
${src.html}
${scriptTag}
</body>
</html>`;
}

/** Serialize a WebSource back into fenced code blocks for a model prompt. */
export function sourceToBlocks(src: WebSource): string {
  const parts: string[] = [];
  if (src.html) parts.push('```html\n' + src.html + '\n```');
  if (src.css) parts.push('```css\n' + src.css + '\n```');
  if (src.js) parts.push('```js\n' + src.js + '\n```');
  return parts.join('\n\n');
}
