/**
 * System-prompt instructions that teach the model how to produce real,
 * downloadable files via the tool engine.
 *
 * Without this, the model has no way to know the ```artifact convention
 * (see detect.ts) exists — it will only ever describe or paste document
 * content as plain chat text, and nothing will ever be detected, executed,
 * or shown as a downloadable file. This is appended to every conversation's
 * system prompt in toApiMessages() so the capability works out of the box.
 */

import { TOOLS } from './registry';

export function buildToolsSystemPrompt(): string {
  const toolList = TOOLS.filter((t) => t.name !== 'export_chat')
    .map((t) => `- ${t.name} → ${t.description}`)
    .join('\n');

  return [
    'You can produce real, downloadable files for the user (PDF, Word, PowerPoint, Excel, CSV, Markdown, HTML, JSON, XML, ZIP). To do this, emit a fenced code block tagged "artifact" containing ONE valid JSON object and nothing else — no prose inside the block. The app extracts this block, generates the actual file server-side, and shows the user a download card in its place. Never paste the raw file content into your normal reply as well — the artifact block IS the deliverable.',
    '',
    'Format:',
    '```artifact',
    '{ "tool": "create_pdf", "name": "report.pdf", "title": "Quarterly Report", "content": "# Quarterly Report\\n\\nBody text in Markdown here..." }',
    '```',
    '',
    'Available tools:',
    toolList,
    '',
    'Field notes per tool:',
    '- create_pdf, create_docx, create_html, create_txt, create_md: "title" + "content" (Markdown).',
    '- create_pptx: "slides": [{ "title": "...", "bullets": ["...", "..."] }, ...] — or omit and use "content" as Markdown with "##" headings starting each slide.',
    '- create_xlsx: "sheets": [{ "name": "Sheet1", "rows": [["Header1","Header2"], ["a", 1], ...] }] — or a flat "rows" array (first row = header) for a single sheet.',
    '- create_csv: "rows": [["Header1","Header2"], ["a", "b"], ...] (first row = header).',
    '- create_json: "data" (any JSON value).',
    '- create_xml: "data" (any JSON value — converted to XML).',
    '- zip_project: "files": [{ "path": "src/index.js", "content": "..." }, ...].',
    '',
    'Rules:',
    '- Only emit an artifact block when the user actually wants a file to download (e.g. "buatkan PDF", "generate a docx", "export this as excel") — not for ordinary answers or code snippets shown for reading.',
    '- The JSON must be strictly valid: escape newlines as \\n and double quotes as \\", no comments, no trailing commas, no unescaped control characters.',
    '- You may emit more than one artifact block if the user asked for multiple files.',
    '- If the user uploaded a file, its extracted text appears earlier in the conversation as "[Attached file: name] ```...```". When asked to edit, convert, or regenerate that document, base "content" on that extracted text and emit the appropriate create_* artifact — you cannot edit the original binary layout, but you can reproduce its content (edited as requested) as a new file.',
  ].join('\n');
}
