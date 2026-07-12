import 'server-only';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ExecutorFn } from './index';
import { stripInline, parseMarkdown, type Block } from '@/lib/documents/markdown';
import { MIME_BY_KIND, EXT_BY_KIND } from '../types';

const createPdf: ExecutorFn = async (req) => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

  const content = req.content ?? '';
  const blocks = parseMarkdown(content);
  const title = req.title ?? req.name ?? 'Document';

  // Title page
  const titlePage = pdfDoc.addPage();
  const { width, height } = titlePage.getSize();
  titlePage.drawText(title, {
    x: 72,
    y: height - 150,
    size: 28,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  titlePage.drawText(`Generated ${new Date().toLocaleDateString()}`, {
    x: 72,
    y: height - 190,
    size: 12,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Content pages
  const marginX = 72;
  const marginTop = 72;
  const marginBot = 72;
  const fontSize = 11;
  const lineHeight = 16;
  const maxW = width - 2 * marginX;
  let page = pdfDoc.addPage();
  let y = page.getSize().height - marginTop;
  const pageH = () => page.getSize().height;

  function newPage() {
    page = pdfDoc.addPage();
    y = pageH() - marginTop;
  }

  function ensureSpace(need: number) {
    if (y - need < marginBot) newPage();
  }

  function drawLine(text: string, opts?: { bold?: boolean; size?: number; mono?: boolean }) {
    const f = opts?.mono ? monoFont : opts?.bold ? boldFont : font;
    const sz = opts?.size ?? fontSize;
    const lineH = sz + 5;
    ensureSpace(lineH);
    page.drawText(text, { x: marginX, y, size: sz, font: f, color: rgb(0.1, 0.1, 0.1) });
    y -= lineH;
  }

  function wrapText(text: string, maxCharsPerLine: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      if (line && line.length + 1 + w.length > maxCharsPerLine) {
        lines.push(line);
        line = w;
      } else {
        line = line ? `${line} ${w}` : w;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  const maxChars = Math.floor(maxW / (fontSize * 0.5));

  function renderBlock(b: Block) {
    switch (b.type) {
      case 'heading': {
        const sz = b.level === 1 ? 20 : b.level === 2 ? 16 : 13;
        ensureSpace(sz + 10);
        y -= 8;
        drawLine(stripInline(b.text), { bold: true, size: sz });
        y -= 4;
        break;
      }
      case 'paragraph': {
        for (const line of wrapText(stripInline(b.text), maxChars)) {
          drawLine(line);
        }
        y -= 6;
        break;
      }
      case 'list': {
        b.items.forEach((item, i) => {
          const prefix = b.ordered ? `${i + 1}. ` : '• ';
          for (const line of wrapText(stripInline(item), maxChars - 2)) {
            drawLine(`${prefix}${line}`);
          }
        });
        y -= 4;
        break;
      }
      case 'quote': {
        for (const line of wrapText(stripInline(b.text), maxChars - 4)) {
          ensureSpace(lineHeight);
          page.drawText(`  ${line}`, {
            x: marginX + 20,
            y,
            size: fontSize,
            font,
            color: rgb(0.4, 0.4, 0.4),
          });
          y -= lineHeight;
        }
        y -= 4;
        break;
      }
      case 'code': {
        for (const line of b.text.split('\n')) {
          ensureSpace(lineHeight);
          page.drawRectangle({
            x: marginX,
            y: y - 2,
            width: maxW,
            height: lineHeight,
            color: rgb(0.95, 0.95, 0.95),
          });
          page.drawText(line.slice(0, maxChars + 20), {
            x: marginX + 8,
            y,
            size: 9,
            font: monoFont,
            color: rgb(0.2, 0.2, 0.2),
          });
          y -= lineHeight;
        }
        y -= 6;
        break;
      }
      case 'hr': {
        ensureSpace(20);
        y -= 10;
        page.drawLine({
          start: { x: marginX, y },
          end: { x: width - marginX, y },
          thickness: 1,
          color: rgb(0.8, 0.8, 0.8),
        });
        y -= 10;
        break;
      }
      case 'table': {
        const cols = b.header.length;
        const colW = Math.floor(maxW / cols);
        // Header
        ensureSpace(lineHeight + 4);
        b.header.forEach((h, ci) => {
          page.drawText(stripInline(h).slice(0, Math.floor(colW / 5)), {
            x: marginX + ci * colW + 4,
            y,
            size: fontSize,
            font: boldFont,
            color: rgb(0.1, 0.1, 0.1),
          });
        });
        y -= lineHeight;
        // Rows
        for (const row of b.rows) {
          ensureSpace(lineHeight);
          row.forEach((cell, ci) => {
            if (ci < cols) {
              page.drawText(stripInline(cell).slice(0, Math.floor(colW / 5)), {
                x: marginX + ci * colW + 4,
                y,
                size: fontSize,
                font,
                color: rgb(0.2, 0.2, 0.2),
              });
            }
          });
          y -= lineHeight;
        }
        y -= 6;
        break;
      }
    }
  }

  for (const b of blocks) {
    renderBlock(b);
  }

  const buffer = Buffer.from(await pdfDoc.save());
  return {
    buffer,
    kind: 'pdf',
    mime: MIME_BY_KIND.pdf,
    ext: EXT_BY_KIND.pdf,
  };
};

export default createPdf;
