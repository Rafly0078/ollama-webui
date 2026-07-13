import 'server-only';

import type { ExecutorFn } from './index';
import { parseInline, parseMarkdown, type Block, type Span } from '@/lib/documents/markdown';
import { MIME_BY_KIND, EXT_BY_KIND } from '../types';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Only allow safe URL schemes; neutralize javascript: and data: links. */
function safeHref(href: string): string {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|tel:|#|\/|\.)/i.test(trimmed)) return escapeHtml(trimmed);
  return '#';
}

function spanToHtml(sp: Span): string {
  let html = escapeHtml(sp.text);
  if (sp.code) html = `<code>${html}</code>`;
  if (sp.strike) html = `<del>${html}</del>`;
  if (sp.italic) html = `<em>${html}</em>`;
  if (sp.bold) html = `<strong>${html}</strong>`;
  if (sp.href) html = `<a href="${safeHref(sp.href)}" rel="noopener noreferrer">${html}</a>`;
  return html;
}

function inline(text: string): string {
  return parseInline(text).map(spanToHtml).join('');
}

function blockToHtml(b: Block): string {
  switch (b.type) {
    case 'heading':
      return `<h${b.level}>${inline(b.text)}</h${b.level}>`;
    case 'paragraph':
      return `<p>${inline(b.text)}</p>`;
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      return `<${tag}>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${tag}>`;
    }
    case 'quote':
      return `<blockquote>${inline(b.text)}</blockquote>`;
    case 'code':
      return `<pre><code${b.lang ? ` class="language-${escapeHtml(b.lang)}"` : ''}>${escapeHtml(b.text)}</code></pre>`;
    case 'hr':
      return '<hr />';
    case 'table': {
      const style = (ci: number) => {
        const a = b.align?.[ci];
        return a && a !== 'left' ? ` style="text-align:${a}"` : '';
      };
      const header = b.header.map((h, ci) => `<th${style(ci)}>${inline(h)}</th>`).join('');
      const rows = b.rows
        .map(
          (row) =>
            `<tr>${Array.from({ length: b.header.length }, (_, ci) => `<td${style(ci)}>${inline(row[ci] ?? '')}</td>`).join('')}</tr>`,
        )
        .join('');
      return `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
    }
  }
}

const createHtml: ExecutorFn = async (req) => {
  const title = (req.title ?? req.name ?? 'Document').trim() || 'Document';
  const blocks = parseMarkdown(req.content ?? '');
  const generated = new Date().toLocaleDateString();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 46rem; margin: 0 auto; padding: 3rem 1.25rem 5rem;
      color: #1a1a16; background: #fff; line-height: 1.65; font-size: 16px;
      -webkit-font-smoothing: antialiased;
    }
    header.doc { border-bottom: 1px solid #e5e7eb; margin-bottom: 2rem; padding-bottom: 1rem; }
    header.doc h1 { margin: 0 0 .25rem; font-size: 2rem; line-height: 1.2; }
    header.doc .meta { color: #6b7280; font-size: .85rem; }
    h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 2rem 0 .75rem; font-weight: 650; }
    h1 { font-size: 1.75rem; } h2 { font-size: 1.4rem; border-bottom: 1px solid #eee; padding-bottom: .3rem; }
    h3 { font-size: 1.15rem; } h4, h5, h6 { font-size: 1rem; }
    p { margin: 0 0 1rem; }
    a { color: #2563eb; text-decoration: none; } a:hover { text-decoration: underline; }
    strong { font-weight: 650; }
    ul, ol { margin: 0 0 1rem; padding-left: 1.5rem; } li { margin: .25rem 0; }
    code { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: .875em; background: #f3f4f6; padding: .15em .4em; border-radius: 4px; }
    pre { background: #f8f9fb; border: 1px solid #eceef1; padding: 1rem 1.15rem; border-radius: 8px; overflow-x: auto; margin: 0 0 1.25rem; }
    pre code { background: none; padding: 0; font-size: .85rem; line-height: 1.5; }
    blockquote { border-left: 3px solid #d1d5db; margin: 0 0 1.25rem; padding: .3rem 0 .3rem 1.1rem; color: #4b5563; }
    table { border-collapse: collapse; width: 100%; margin: 0 0 1.25rem; font-size: .925rem; }
    th, td { border: 1px solid #e5e7eb; padding: .5rem .7rem; text-align: left; vertical-align: top; }
    thead th { background: #f3f4f6; font-weight: 650; }
    tbody tr:nth-child(even) { background: #fafafa; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
    img { max-width: 100%; height: auto; }
    @media (prefers-color-scheme: dark) {
      body { background: #17171a; color: #e6e6e3; }
      header.doc { border-color: #2a2a2e; } header.doc .meta { color: #9ca3af; }
      h2 { border-color: #2a2a2e; }
      a { color: #6ea8fe; }
      code { background: #26262b; } pre { background: #1d1d21; border-color: #2a2a2e; }
      blockquote { border-color: #3f3f46; color: #b4b4bd; }
      th, td { border-color: #2a2a2e; } thead th { background: #232327; } tbody tr:nth-child(even) { background: #1c1c20; }
      hr { border-color: #2a2a2e; }
    }
  </style>
</head>
<body>
  <header class="doc">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated ${escapeHtml(generated)}</div>
  </header>
${blocks.map(blockToHtml).map((h) => `  ${h}`).join('\n')}
</body>
</html>`;

  const buffer = Buffer.from(html, 'utf-8');
  return { buffer, kind: 'html', mime: MIME_BY_KIND.html, ext: EXT_BY_KIND.html };
};

export default createHtml;
