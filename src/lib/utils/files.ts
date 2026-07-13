import type { Attachment } from '@/types';
import { uid } from './id';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12MB
const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 2MB

export function isImage(file: File): boolean {
  return file.type.startsWith('image/');
}
export function isText(file: File): boolean {
  return (
    file.type.startsWith('text/') ||
    /\.(txt|md|csv|json|log|ya?ml|xml|ts|tsx|js|jsx|py|go|rs|java|c|cpp|sh)$/i.test(file.name)
  );
}
export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
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

// Most vision models don't benefit from anything past ~1568px on the long
// edge, and full-resolution phone photos (4000px+, several MB) are the most
// common reason an image request silently fails against a proxied/serverless
// backend with a request-size cap. Downscale + re-encode as JPEG before send.
const MAX_IMAGE_DIMENSION = 1568;
const IMAGE_JPEG_QUALITY = 0.88;

/**
 * Downscale an image data URL if it's larger than MAX_IMAGE_DIMENSION on its
 * long edge, re-encoding as JPEG to keep payload size reasonable. Falls back
 * to the original data URL untouched if anything about this fails (canvas
 * unavailable, decode error, etc.) — resizing is a best-effort optimization,
 * never a hard requirement.
 */
function downscaleImageDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        const longEdge = Math.max(width, height);
        if (longEdge <= MAX_IMAGE_DIMENSION) {
          resolve(dataUrl);
          return;
        }
        const scale = MAX_IMAGE_DIMENSION / longEdge;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Convert a File into an Attachment. Images become base64 for vision models,
 * text/pdf become inlined text. PDF text extraction is best-effort: we lazily
 * import pdfjs only when needed to keep the initial bundle small; if it isn't
 * available we fall back to a note so the flow never hard-fails.
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
    const originalDataUrl = await readAsDataUrl(file);
    const dataUrl = await downscaleImageDataUrl(originalDataUrl);
    return {
      ...base,
      previewUrl: dataUrl,
      base64: dataUrl.split(',')[1] ?? '',
    };
  }

  if (isText(file)) {
    if (file.size > MAX_TEXT_BYTES) throw new Error(`File "${file.name}" exceeds 2MB.`);
    const text = await readAsText(file);
    return { ...base, text };
  }

  if (isPdf(file)) {
    const text = await extractPdfText(file).catch(() => '');
    return {
      ...base,
      text: text || `[PDF "${file.name}" attached — text could not be extracted client-side]`,
    };
  }

  throw new Error(`Unsupported file type: ${file.name}`);
}

async function extractPdfText(file: File): Promise<string> {
  // Lazy import — pdfjs only downloads (as a separate chunk) when a PDF is added.
  try {
    const pdfjs = await import('pdfjs-dist');
    // Load the worker from the package (bundler resolves it to a hashed asset).
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
      out += content.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ') + '\n\n';
    }
    return out.trim();
  } catch {
    return '';
  }
}
