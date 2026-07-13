import 'server-only';

import type { ExecutorFn } from './index';
import { MIME_BY_KIND, EXT_BY_KIND } from '../types';

function escapeCsvField(val: string | number | boolean | null): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  // RFC 4180: quote fields containing comma, quote, or CR/LF; double embedded quotes.
  // Also quote a leading =/+/-/@ so spreadsheets don't treat the cell as a formula.
  if (/[",\r\n]/.test(s) || /^[=+\-@]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const createCsv: ExecutorFn = async (req) => {
  const rows = req.rows ?? [];
  // RFC 4180 uses CRLF row terminators; a UTF-8 BOM makes Excel read accented
  // text correctly instead of mangling it as Latin-1.
  const body = rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
  const buffer = Buffer.from(`﻿${body}`, 'utf-8');
  return { buffer, kind: 'csv', mime: MIME_BY_KIND.csv, ext: EXT_BY_KIND.csv };
};

export default createCsv;
