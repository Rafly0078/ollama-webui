import 'server-only';

/**
 * Minimal Markdown block parser for document generation. Not a full CommonMark
 * implementation — it covers the structures the generators render: headings,
 * paragraphs, bullet/numbered lists, blockquotes, fenced code, horizontal
 * rules, and tables. Inline emphasis markers are stripped for plain rendering.
 */

export type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; lang?: string; text: string }
  | { type: 'hr' }
  | { type: 'table'; header: string[]; rows: string[][] };

/** Strip common inline Markdown so plain renderers show clean text. */
export function stripInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
    .trim();
}

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => stripInline(c.trim()));
}

export function parseMarkdown(md: string): Block[] {
  const lines = (md ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    let line = lines[i] ?? '';

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      const lang = fence[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? '')) {
        buf.push(lines[i] ?? '');
        i++;
      }
      i++; // closing fence
      blocks.push({ type: 'code', lang, text: buf.join('\n') });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1]!.length,
        text: stripInline(heading[2]!),
      });
      i++;
      continue;
    }

    // Table (header row followed by a separator row of dashes)
    if (line.includes('|') && /^\s*\|?.*\|.*$/.test(line)) {
      const sep = lines[i + 1] ?? '';
      if (/^\s*\|?[\s:-]*-[\s:|-]*$/.test(sep) && sep.includes('-')) {
        const header = splitTableRow(line);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && (lines[i] ?? '').includes('|') && (lines[i] ?? '').trim()) {
          rows.push(splitTableRow(lines[i] ?? ''));
          i++;
        }
        blocks.push({ type: 'table', header, rows });
        continue;
      }
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) {
        buf.push(stripInline((lines[i] ?? '').replace(/^>\s?/, '')));
        i++;
      }
      blocks.push({ type: 'quote', text: buf.join(' ') });
      continue;
    }

    // Lists (bullet or ordered)
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i] ?? '';
        const b = l.match(/^\s*[-*+]\s+(.*)$/);
        const o = l.match(/^\s*\d+\.\s+(.*)$/);
        if (isOrdered && o) items.push(stripInline(o[1]!));
        else if (!isOrdered && b) items.push(stripInline(b[1]!));
        else break;
        i++;
      }
      blocks.push({ type: 'list', ordered: isOrdered, items });
      continue;
    }

    // Paragraph — gather consecutive non-blank, non-structural lines
    const buf: string[] = [];
    while (i < lines.length) {
      line = lines[i] ?? '';
      if (
        !line.trim() ||
        /^(#{1,6})\s+/.test(line) ||
        /^```/.test(line) ||
        /^>\s?/.test(line) ||
        /^\s*[-*+]\s+/.test(line) ||
        /^\s*\d+\.\s+/.test(line) ||
        /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)
      ) {
        break;
      }
      buf.push(line.trim());
      i++;
    }
    if (buf.length) blocks.push({ type: 'paragraph', text: stripInline(buf.join(' ')) });
  }

  return blocks;
}
