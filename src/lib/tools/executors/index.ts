import 'server-only';

import type { Artifact, ArtifactKind, GenerateRequest, ToolName } from '../types';

export interface ExecutorContext {
  userId: string;
  conversationId?: string;
  messageId?: string;
}

export type ExecutorFn = (
  req: GenerateRequest,
  ctx: ExecutorContext,
) => Promise<{ buffer: Buffer; kind: ArtifactKind; mime: string; ext: string }>;

const registry = new Map<ToolName, ExecutorFn>();

export function registerExecutor(tool: ToolName, fn: ExecutorFn): void {
  registry.set(tool, fn);
}

export function getExecutor(tool: ToolName): ExecutorFn | undefined {
  return registry.get(tool);
}

// Import all executors to register them
import './pdf';
import './docx';
import './pptx';
import './xlsx';
import './csv';
import './txt';
import './md';
import './html';
import './json';
import './xml';
import './zip';
