import 'server-only';

import ExcelJS from 'exceljs';
import type { ExecutorFn } from './index';
import { MIME_BY_KIND, EXT_BY_KIND, type SheetSpec } from '../types';

type Cell = string | number | boolean | null;

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F2937' },
};
const THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
};

/**
 * Coerce model-produced string cells to real numbers so Excel can sum/sort
 * them. A cell like "1,234.5" or "42%" arrives as a string; leaving it as text
 * is the most common reason a generated sheet "looks right but won't add up".
 */
function coerce(value: Cell): Cell {
  if (typeof value !== 'string') return value;
  const s = value.trim();
  if (s === '') return '';
  const pct = /%$/.test(s);
  const num = s.replace(/[,$€£\s]/g, '').replace(/%$/, '');
  if (/^-?\d+(\.\d+)?$/.test(num)) {
    const n = Number(num);
    return pct ? n / 100 : n;
  }
  return value;
}

function fillSheet(ws: ExcelJS.Worksheet, rows: Cell[][]): void {
  if (rows.length === 0) return;
  const width = Math.max(...rows.map((r) => r.length));
  const pctCols = new Set<number>();

  rows.forEach((row, ri) => {
    const cells = Array.from({ length: width }, (_, ci) => {
      const raw = row[ci] ?? null;
      if (ri === 0) return raw; // header stays as-is (labels)
      const c = coerce(raw);
      if (typeof raw === 'string' && /%$/.test(raw.trim()) && typeof c === 'number') pctCols.add(ci + 1);
      return c;
    });
    const added = ws.addRow(cells);
    added.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = THIN;
      cell.alignment = { vertical: 'top', wrapText: true };
      if (typeof cell.value === 'number') cell.alignment = { ...cell.alignment, horizontal: 'right' };
    });
  });

  // Header styling.
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 20;

  // Percentage columns get a percent number format.
  pctCols.forEach((col) => {
    ws.getColumn(col).numFmt = '0.0%';
  });

  // Freeze the header row and enable an autofilter over the data extent.
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length, column: width } };

  // Auto-size columns from content length (capped so one long cell can't blow
  // the layout out).
  for (let col = 1; col <= width; col++) {
    let max = 10;
    ws.getColumn(col).eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = len;
    });
    ws.getColumn(col).width = Math.min(max + 2, 48);
  }
}

const createXlsx: ExecutorFn = async (req) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AI Workspace';
  workbook.created = new Date();

  const sheets: SheetSpec[] = req.sheets ?? [];
  if (sheets.length > 0) {
    sheets.forEach((spec, i) => {
      const name = (spec.name || `Sheet ${i + 1}`).slice(0, 31).replace(/[\\/?*[\]:]/g, ' ');
      fillSheet(workbook.addWorksheet(name), spec.rows ?? []);
    });
  } else if ((req.rows ?? []).length > 0) {
    fillSheet(workbook.addWorksheet('Sheet 1'), req.rows!);
  } else {
    workbook.addWorksheet('Sheet 1');
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer, kind: 'xlsx', mime: MIME_BY_KIND.xlsx, ext: EXT_BY_KIND.xlsx };
};

export default createXlsx;
