import 'server-only';

import type { ArtifactKind, GenerateRequest, ToolName } from '../types';
import createPdf from './pdf';
import createDocx from './docx';
import createPptx from './pptx';
import createXlsx from './xlsx';
import createCsv from './csv';
import createTxt from './txt';
import createMd from './md';
import createHtml from './html';
import createJson from './json';
import createXml from './xml';
import zipProject from './zip';

export interface ExecutorContext {
  userId: string;
  conversationId?: string;
  messageId?: string;
}

export type ExecutorFn = (
  req: GenerateRequest,
  ctx: ExecutorContext,
) => Promise<{ buffer: Buffer; kind: ArtifactKind; mime: string; ext: string }>;

// Each executor module exports its function directly (no shared mutable
// registry to import back into) so there's no circular dependency between
// this file and the executor modules.
const registry = new Map<ToolName, ExecutorFn>([
  ['create_pdf', createPdf],
  ['create_docx', createDocx],
  ['create_pptx', createPptx],
  ['create_xlsx', createXlsx],
  ['create_csv', createCsv],
  ['create_txt', createTxt],
  ['create_md', createMd],
  ['create_html', createHtml],
  ['create_json', createJson],
  ['create_xml', createXml],
  ['zip_project', zipProject],
]);

export function getExecutor(tool: ToolName): ExecutorFn | undefined {
  return registry.get(tool);
}
