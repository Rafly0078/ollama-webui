import 'server-only';

import type { ExecutorFn } from './index';
import { MIME_BY_KIND, EXT_BY_KIND } from '../types';

function escapeCsvField(val: string | number | boolean | null): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const createCsv: ExecutorFn = async (req) => {
  const rows = req.rows ?? [];
  const lines = rows.map((row) => row.map(escapeCsvField).join(','));
  const csv = lines.join('\n');
  const buffer = Buffer.from(csv, 'utf-8');
  return {
    buffer,
    kind: 'csv',
    mime: MIME_BY_KIND.csv,
    ext: EXT_BY_KIND.csv,
  };
};

export default createCsv;
