import 'server-only';

import ExcelJS from 'exceljs';
import type { ExecutorFn } from './index';
import { MIME_BY_KIND, EXT_BY_KIND, type SheetSpec } from '../types';

/** Safely auto-size columns by iterating rows directly. */
function autoWidth(ws: ExcelJS.Worksheet): void {
  const colWidths = new Map<number, number>();
  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const len = String(cell.value ?? '').length;
      const prev = colWidths.get(colNumber) ?? 10;
      if (len > prev) colWidths.set(colNumber, len);
    });
  });
  colWidths.forEach((len, colNumber) => {
    const col = ws.getColumn(colNumber);
    if (col) col.width = Math.min(len + 2, 40);
  });
}

const createXlsx: ExecutorFn = async (req) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AI Workspace';
  workbook.created = new Date();

  const sheets: SheetSpec[] = req.sheets ?? [];
  const singleRows = req.rows ?? [];

  if (sheets.length > 0) {
    for (const spec of sheets) {
      const ws = workbook.addWorksheet(spec.name);
      if (spec.rows.length > 0) {
        const header = spec.rows[0];
        if (header) {
          ws.addRow(header);
          ws.getRow(1).font = { bold: true };
          ws.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F0F0' },
          };
        }
        for (let i = 1; i < spec.rows.length; i++) {
          ws.addRow(spec.rows[i]!);
        }
        autoWidth(ws);
      }
    }
  } else if (singleRows.length > 0) {
    const ws = workbook.addWorksheet('Sheet 1');
    const header = singleRows[0];
    if (header) {
      ws.addRow(header);
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F0F0' },
      };
    }
    for (let i = 1; i < singleRows.length; i++) {
      ws.addRow(singleRows[i]!);
    }
    autoWidth(ws);
  } else {
    workbook.addWorksheet('Sheet 1');
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    buffer,
    kind: 'xlsx',
    mime: MIME_BY_KIND.xlsx,
    ext: EXT_BY_KIND.xlsx,
  };
};

export default createXlsx;
