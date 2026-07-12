import 'server-only';

import { registerExecutor } from './index';
import { MIME_BY_KIND, EXT_BY_KIND } from '../types';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function objectToXml(obj: unknown, indent: number = 0): string {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return escapeXml(String(obj));
  if (Array.isArray(obj)) {
    return obj.map((item) => `${pad}<item>\n${objectToXml(item, indent + 1)}\n${pad}</item>`).join('\n');
  }
  const entries = Object.entries(obj as Record<string, unknown>);
  return entries
    .map(([key, val]) => {
      if (val === null || val === undefined) return `${pad}<${key}/>`;
      if (typeof val === 'object' && !Array.isArray(val)) {
        return `${pad}<${key}>\n${objectToXml(val, indent + 1)}\n${pad}</${key}>`;
      }
      if (Array.isArray(val)) {
        return `${pad}<${key}>\n${objectToXml(val, indent + 1)}\n${pad}</${key}>`;
      }
      return `${pad}<${key}>${escapeXml(String(val))}</${key}>`;
    })
    .join('\n');
}

registerExecutor('create_xml', async (req) => {
  let data = req.data ?? req.content ?? '';

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      // Keep as string
    }
  }

  const title = req.title ?? req.name ?? 'document';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${title}>\n${objectToXml(data)}\n</${title}>`;
  const buffer = Buffer.from(xml, 'utf-8');
  return {
    buffer,
    kind: 'xml',
    mime: MIME_BY_KIND.xml,
    ext: EXT_BY_KIND.xml,
  };
});
