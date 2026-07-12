import 'server-only';

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  convertInchesToTwip,
} from 'docx';
import { registerExecutor } from './index';
import { parseMarkdown, type Block } from '@/lib/documents/markdown';
import { MIME_BY_KIND, EXT_BY_KIND } from '../types';

function blockToDocx(b: Block): (Paragraph | Table)[] {
  switch (b.type) {
    case 'heading': {
      const level =
        b.level === 1 ? HeadingLevel.HEADING_1 :
        b.level === 2 ? HeadingLevel.HEADING_2 :
        b.level === 3 ? HeadingLevel.HEADING_3 :
        HeadingLevel.HEADING_4;
      return [new Paragraph({ heading: level, children: [new TextRun(b.text)] })];
    }
    case 'paragraph':
      return [new Paragraph({ children: [new TextRun(b.text)], spacing: { after: 200 } })];
    case 'list':
      return b.items.map(
        (item) =>
          new Paragraph({
            children: [new TextRun(item)],
            bullet: b.ordered ? { level: 0 } : { level: 0 },
            numbering: b.ordered ? { reference: 'default-numbering', level: 0 } : undefined,
          }),
      );
    case 'quote':
      return [
        new Paragraph({
          children: [new TextRun({ text: b.text, italics: true, color: '666666' })],
          indent: { left: convertInchesToTwip(0.5) },
          spacing: { after: 200 },
        }),
      ];
    case 'code':
      return b.text.split('\n').map(
        (line) =>
          new Paragraph({
            children: [new TextRun({ text: line, font: 'Courier New', size: 18 })],
            spacing: { after: 0 },
          }),
      );
    case 'hr':
      return [
        new Paragraph({
          children: [new TextRun('')],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
        }),
      ];
    case 'table': {
      const headerRow = new TableRow({
        children: b.header.map(
          (h) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
              shading: { fill: 'F0F0F0' },
            }),
        ),
        tableHeader: true,
      });
      const dataRows = b.rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun(cell)] })],
                }),
            ),
          }),
      );
      return [
        new Table({
          rows: [headerRow, ...dataRows],
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
      ];
    }
    default:
      return [];
  }
}

registerExecutor('create_docx', async (req) => {
  const content = req.content ?? '';
  const blocks = parseMarkdown(content);
  const title = req.title ?? req.name ?? 'Document';

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun(title)],
          }),
          new Paragraph({
            children: [new TextRun({ text: `Generated ${new Date().toLocaleDateString()}`, color: '999999', size: 20 })],
            spacing: { after: 400 },
          }),
          ...blocks.flatMap(blockToDocx),
        ],
      },
    ],
  });

  const buffer = Buffer.from(await Packer.toBuffer(doc));
  return {
    buffer,
    kind: 'docx',
    mime: MIME_BY_KIND.docx,
    ext: EXT_BY_KIND.docx,
  };
});
