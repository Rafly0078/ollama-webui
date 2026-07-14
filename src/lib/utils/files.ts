import type { Attachment } from '@/types';
import { uid } from './id';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12MB
const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_OFFICE_BYTES = 25 * 1024 * 1024; // 25MB (zipped Office docs)

export function isImage(file: File): boolean {
  return file.type.startsWith('image/');
}
export function isText(file: File): boolean {
  return (
    file.type.startsWith('text/') ||
    /^application\/(json|xml|x-yaml|x-sh|javascript|typescript)$/.test(file.type) ||
    /\.(txt|md|markdown|csv|tsv|json|jsonl|log|ya?ml|toml|ini|env|xml|html?|css|scss|svg|ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|c|h|cpp|hpp|cs|rb|php|swift|sql|sh|bash|zsh|ps1|bat|dockerfile|gitignore|conf)$/i.test(
      file.name,
    )
  );
}
export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}
function isDocx(file: File): boolean {
  return /\.docx$/i.test(file.name) || file.type.includes('wordprocessingml');
}
function isPptx(file: File): boolean {
  return /\.pptx$/i.test(file.name) || file.type.includes('presentationml');
}
function isXlsx(file: File): boolean {
  return /\.xlsx$/i.test(file.name) || file.type.includes('spreadsheetml');
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Convert a File into an Attachment. Every file is accepted — nothing throws
 * an "unsupported type" error anymore:
 *   - images → base64 for vision models
 *   - text/code/pdf/office docs → extracted text inlined into the prompt
 *   - anything else (binary) → a short descriptive note so the model at least
 *     knows a file was attached
 * Extraction is best-effort and lazily loads heavy parsers only when needed.
 */
export async function fileToAttachment(file: File): Promise<Attachment> {
  const base: Attachment = {
    id: uid(),
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
  };

  if (isImage(file)) {
    if (file.size > MAX_IMAGE_BYTES) throw new Error(`Image "${file.name}" exceeds 12MB.`);
    const dataUrl = await readAsDataUrl(file);
    return { ...base, previewUrl: dataUrl, base64: dataUrl.split(',')[1] ?? '' };
  }

  if (isText(file)) {
    if (file.size > MAX_TEXT_BYTES) throw new Error(`File "${file.name}" exceeds 2MB.`);
    return { ...base, text: await readAsText(file) };
  }

  if (isPdf(file)) {
    const text = await extractPdfText(file).catch(() => '');
    return { ...base, text: text || noteFor(file, 'text could not be extracted') };
  }

  if ((isDocx(file) || isPptx(file) || isXlsx(file)) && file.size <= MAX_OFFICE_BYTES) {
    const text = await extractOffice(file).catch(() => '');
    return { ...base, text: text || noteFor(file, 'content could not be extracted') };
  }

  // Unknown / binary — attach a note instead of failing the whole send.
  return { ...base, text: noteFor(file) };
}

/** A stand-in body for files whose bytes can't be turned into useful text. */
function noteFor(file: File, reason?: string): string {
  const kind = file.type || 'unknown type';
  const why = reason ? ` — ${reason}` : ' — binary content, not readable as text';
  return `[Attached file: ${file.name} (${kind}, ${humanSize(file.size)})${why}]`;
}

async function extractPdfText(file: File): Promise<string> {
  // Lazy import — pdfjs only downloads (as a separate chunk) when a PDF is added.
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    let out = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      out += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n\n';
    }
    return out.trim();
  } catch {
    return '';
  }
}

/** Pull readable text out of a zipped Office document (docx/pptx/xlsx). */
async function extractOffice(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const xmlToText = (xml: string): string =>
    xml
      // Keep paragraph/line/cell boundaries as whitespace before stripping tags.
      .replace(/<\/(w:p|a:p|text:p)>/g, '\n')
      .replace(/<(w:br|a:br)\b[^>]*\/?>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  if (isDocx(file)) {
    const doc = zip.file('word/document.xml');
    return doc ? xmlToText(await doc.async('string')) : '';
  }

  if (isPptx(file)) {
    // Slides are individual files; order them numerically (slide1, slide2, …).
    const slideFiles = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => {
        const na = Number(a.match(/slide(\d+)/)?.[1] ?? 0);
        const nb = Number(b.match(/slide(\d+)/)?.[1] ?? 0);
        return na - nb;
      });
    const parts: string[] = [];
    for (let i = 0; i < slideFiles.length; i++) {
      const f = zip.file(slideFiles[i]!);
      if (!f) continue;
      const body = xmlToText(await f.async('string'));
      if (body) parts.push(`--- Slide ${i + 1} ---\n${body}`);
    }
    return parts.join('\n\n');
  }

  // xlsx: read shared strings + each sheet's cell values into a simple grid.
  const shared: string[] = [];
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (ssFile) {
    const ss = await ssFile.async('string');
    for (const m of ss.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) {
      shared.push((m[1] ?? '').replace(/<[^>]+>/g, ''));
    }
  }
  const sheetNames = Object.keys(zip.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort();
  const out: string[] = [];
  for (const name of sheetNames) {
    const f = zip.file(name);
    if (!f) continue;
    const xml = await f.async('string');
    const rows: string[] = [];
    for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = c[1] ?? '';
        const type = /\bt="([^"]*)"/.exec(attrs)?.[1];
        const inner = c[2] ?? '';
        if (type === 'inlineStr') {
          cells.push((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '').replace(/<[^>]+>/g, ''));
          continue;
        }
        const v = inner.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? '';
        cells.push(type === 's' ? (shared[Number(v)] ?? '') : v);
      }
      if (cells.some((x) => x !== '')) rows.push(cells.join('\t'));
    }
    if (rows.length) out.push(rows.join('\n'));
  }
  return out.join('\n\n');
}
