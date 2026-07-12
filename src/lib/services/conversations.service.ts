'use client';

/**
 * Conversation persistence. The store's unit of work is a whole Conversation
 * (with its messages), so this service mirrors that: load all, upsert one
 * (conversation row + replace its messages), and delete. UI/stores call this —
 * never Supabase directly — so the backend stays replaceable.
 *
 * All calls run as the signed-in user under RLS. When Supabase isn't
 * configured, methods no-op / return empty so guest mode keeps working.
 */

import type { Conversation, Message } from '@/types';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import {
  conversationToRow,
  messageToRow,
  rowToConversation,
  rowToMessage,
} from './mappers';
import type { ConversationRow, MessageRow } from '@/lib/supabase/types';

/** Load every conversation for the current user, newest first, with messages. */
export async function loadConversations(): Promise<Conversation[]> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];

  const { data: convoRows, error } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!convoRows?.length) return [];

  const ids = convoRows.map((c) => c.id);
  const { data: msgRows, error: msgErr } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', ids)
    .order('seq', { ascending: true });
  if (msgErr) throw new Error(msgErr.message);

  const byConvo = new Map<string, Message[]>();
  for (const row of (msgRows ?? []) as MessageRow[]) {
    const list = byConvo.get(row.conversation_id) ?? [];
    list.push(rowToMessage(row));
    byConvo.set(row.conversation_id, list);
  }

  return (convoRows as ConversationRow[]).map((row) =>
    rowToConversation(row, byConvo.get(row.id) ?? []),
  );
}

/**
 * Upsert a conversation and replace its message set. Simpler and race-free vs
 * diffing: delete this conversation's messages, re-insert in order. Volumes per
 * conversation are small, so this is cheap and always consistent.
 */
export async function saveConversation(convo: Conversation, userId: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;

  const { error: convoErr } = await supabase
    .from('conversations')
    .upsert(conversationToRow(convo, userId), { onConflict: 'id' });
  if (convoErr) throw new Error(convoErr.message);

  const { error: delErr } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', convo.id);
  if (delErr) throw new Error(delErr.message);

  if (convo.messages.length) {
    const rows = convo.messages.map((m, i) => messageToRow(m, convo.id, userId, i));
    const { error: insErr } = await supabase.from('messages').insert(rows);
    if (insErr) throw new Error(insErr.message);
  }
}

/** Persist only the conversation row (title, model, pin, params) — no messages. */
export async function saveConversationMeta(convo: Conversation, userId: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const { error } = await supabase
    .from('conversations')
    .upsert(conversationToRow(convo, userId), { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function deleteConversation(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const { error } = await supabase.from('conversations').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
