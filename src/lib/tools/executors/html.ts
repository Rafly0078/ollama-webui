import 'server-only';

import { registerExecutor } from './index';
import { parseMarkdown, type Block } from '@/lib/documents/markdown';
import { MIME_BY_KIND, EXT_BY_KIND } from '../types';

function blockToHtml(b: Block): string {
  switch (b.type) {
    case 'heading':
      return `<h${b.level}>${escapeHtml(b.text)}</h${b.level}>`;
    case 'paragraph':
      return `<p>${escapeHtml(b.text)}</p>`;
    case 'list':
      const tag = b.ordered ? 'ol' : 'ul';
      return `<${tag}>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</${tag}>`;
    case 'quote':
      return `<blockquote>${escapeHtml(b.text)}</blockquote>`;
    case 'code':
      return `<pre><code class="${b.lang ? `language-${b.lang}` : ''}">${escapeHtml(b.text)}</code></pre>`;
    case 'hr':
      return '<hr />';
    case 'table': {
      const header = b.header.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
      const rows = b.rows
        .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('');
      return `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

registerExecutor('create_html', async (req) => {
  const title = req.title ?? req.name ?? 'Document';
  const content = req.content ?? '';
  const blocks = parseMarkdown(content);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #1a1a16; line-height: 1.6; }
    h1, h2, h3 { margin-top: 1.5rem; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    code { font-family: monospace; }
    blockquote { border-left: 4px solid #ccc; margin: 1rem 0; padding: 0.5rem 1rem; color: #555; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    hr { border: none; border-top: 1px solid #ddd; margin: 2rem 0; }
  </style>
</head>
<body>
  ${blocks.map(blockToHtml).join('\n')}
</body>
</html>`;

  const buffer = Buffer.from(html, 'utf-8');
  return {
    buffer,
    kind: 'html',
    mime: MIME_BY_KIND.html,
    ext: EXT_BY_KIND.html,
  };
});
