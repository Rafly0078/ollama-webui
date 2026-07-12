import 'server-only';

import PptxGenJS from 'pptxgenjs';
import type { ExecutorFn } from './index';
import { MIME_BY_KIND, EXT_BY_KIND, type SlideSpec } from '../types';

const createPptx: ExecutorFn = async (req) => {
  const pptx = new PptxGenJS();
  pptx.title = req.title ?? req.name ?? 'Presentation';
  pptx.author = 'AI Workspace';
  pptx.layout = 'LAYOUT_WIDE';

  const slides: SlideSpec[] = req.slides ?? [];

  // If no slides provided, try parsing content as markdown
  if (slides.length === 0 && req.content) {
    const lines = req.content.split('\n');
    let current: SlideSpec | null = null;

    for (const line of lines) {
      const h2 = line.match(/^##\s+(.+)/);
      const h3 = line.match(/^###\s+(.+)/);
      const bullet = line.match(/^[-*]\s+(.+)/);

      if (h2 || h3) {
        if (current) slides.push(current);
        current = { title: (h2?.[1] ?? h3?.[1] ?? '').trim(), bullets: [] };
      } else if (bullet && current) {
        current.bullets!.push(bullet[1]!.trim());
      } else if (current && !current.title && line.trim()) {
        current.title = line.trim();
      }
    }
    if (current) slides.push(current);
  }

  // Fallback: single title slide
  if (slides.length === 0) {
    slides.push({ title: req.title ?? 'Presentation', body: req.content ?? '' });
  }

  for (const slide of slides) {
    const s = pptx.addSlide();
    if (slide.title) {
      s.addText(slide.title, {
        x: 0.8,
        y: 0.4,
        w: '85%',
        h: 1.2,
        fontSize: 32,
        bold: true,
        color: '1A1A16',
        fontFace: 'Arial',
      });
    }
    if (slide.bullets?.length) {
      s.addText(
        slide.bullets.map((b) => ({ text: b, options: { bullet: true, fontSize: 18, color: '333333' } })),
        {
          x: 0.8,
          y: 1.8,
          w: '85%',
          h: 4.5,
          valign: 'top',
          fontFace: 'Arial',
        },
      );
    } else if (slide.body) {
      s.addText(slide.body, {
        x: 0.8,
        y: 1.8,
        w: '85%',
        h: 4.5,
        fontSize: 16,
        color: '333333',
        valign: 'top',
        fontFace: 'Arial',
      });
    }
  }

  const blob = await pptx.write({ outputType: 'nodebuffer' });
  const buffer = Buffer.isBuffer(blob) ? blob : Buffer.from(blob as ArrayBuffer);
  return {
    buffer,
    kind: 'pptx',
    mime: MIME_BY_KIND.pptx,
    ext: EXT_BY_KIND.pptx,
  };
};

export default createPptx;
