/**
 * Row <-> domain mappers. Keep the DB shape (snake_case rows) isolated here so
 * the rest of the app only ever deals with the domain types in @/types.
 */

import type { Conversation, GenerationParams, Message, Role } from '@/types';
import { DEFAULT_PARAMS } from '@/lib/store/defaults';
import type { ArtifactKind, Artifact } from '@/lib/tools/types';
import type { ArtifactRow, ConversationRow, MessageRow } from '@/lib/supabase/types';

const isoToMs = (iso: string): number => new Date(iso).getTime();
const msToIso = (ms: number): string => new Date(ms).toISOString();

export function rowToConversation(row: ConversationRow, messages: Message[]): Conversation {
  const params = { ...DEFAULT_PARAMS, ...(row.params as Partial<GenerationParams>) };
  return {
    id: row.id,
    title: row.title,
    messages,
    model: row.model,
    systemPrompt: row.system_prompt,
    params,
    pinned: row.pinned,
    createdAt: isoToMs(row.created_at),
    updatedAt: isoToMs(row.updated_at),
  };
}

export function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    role: row.role as Role,
    content: row.content,
    createdAt: isoToMs(row.created_at),
    model: row.model ?? undefined,
    metrics: row.metrics ?? undefined,
    error: row.error ?? undefined,
  };
}

/**
 * Map a persisted artifact row back to the domain Artifact shape used by the
 * UI. We deliberately do NOT set `url` here — signed URLs expire, so the URL is
 * minted fresh on display via /api/artifacts/refresh (see ArtifactPanel), which
 * only needs `bucket` + `storagePath`.
 */
export function rowToArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    conversationId: row.conversation_id ?? undefined,
    messageId: row.message_id ?? undefined,
    kind: row.kind as ArtifactKind,
    name: row.name,
    mimeType: row.mime_type ?? 'application/octet-stream',
    size: row.size_bytes,
    version: row.version,
    createdAt: isoToMs(row.created_at),
    bucket: row.bucket,
    storagePath: row.storage_path,
    ephemeral: false,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
  };
}

export function conversationToRow(
  convo: Conversation,
  userId: string,
): Omit<ConversationRow, 'workspace_id' | 'folder' | 'favorite' | 'archived' | 'parent_id'> {
  return {
    id: convo.id,
    user_id: userId,
    title: convo.title,
    model: convo.model,
    system_prompt: convo.systemPrompt,
    params: convo.params,
    pinned: convo.pinned,
    created_at: msToIso(convo.createdAt),
    updated_at: msToIso(convo.updatedAt),
  };
}

export function messageToRow(
  msg: Message,
  convoId: string,
  userId: string,
  seq: number,
): Omit<MessageRow, 'updated_at' | 'parent_id'> {
  return {
    id: msg.id,
    conversation_id: convoId,
    user_id: userId,
    role: msg.role,
    content: msg.content,
    model: msg.model ?? null,
    metrics: msg.metrics ?? null,
    error: msg.error ?? null,
    seq,
    created_at: msToIso(msg.createdAt),
  };
}
