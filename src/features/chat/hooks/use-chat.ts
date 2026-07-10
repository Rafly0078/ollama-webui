'use client';

import { useCallback } from 'react';
import type { Attachment, Message } from '@/types';
import { useChatStore } from '@/lib/store/chat-store';
import { ApiError } from '@/lib/api/config';
import { streamChat } from '@/lib/api/client';
import { toApiMessages, toApiOptions, type ChatStreamChunk } from '@/lib/api/types';
import { uid } from '@/lib/utils/id';

/**
 * The controller for the in-flight generation. Kept at module scope (only one
 * generation runs at a time) so it can be aborted from anywhere — e.g. the
 * global Esc shortcut — without threading refs through the component tree.
 */
let activeController: AbortController | null = null;

/** Abort the current generation, if any. Safe to call when idle. */
export function stopActiveGeneration(): void {
  activeController?.abort();
  activeController = null;
  useChatStore.getState().setGenerating(null);
}

/** Derive a short title from the first user message. */
function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 'New chat';
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
}

function metricsFromChunk(final: ChatStreamChunk, startedAt: number) {
  const responseTimeMs = Date.now() - startedAt;
  const completionTokens = final.eval_count;
  const promptTokens = final.prompt_eval_count;
  // eval_duration is in nanoseconds (Ollama). tokens/sec = tokens / seconds.
  let tokensPerSecond: number | undefined;
  if (completionTokens && final.eval_duration) {
    tokensPerSecond = completionTokens / (final.eval_duration / 1e9);
  } else if (completionTokens) {
    tokensPerSecond = completionTokens / (responseTimeMs / 1000);
  }
  return { responseTimeMs, completionTokens, promptTokens, tokensPerSecond };
}

export function useChat(conversationId: string | null) {
  const store = useChatStore;

  const stop = useCallback(() => {
    stopActiveGeneration();
  }, []);

  /** Core streaming routine: streams into an existing assistant message id. */
  const runStream = useCallback(
    async (convoId: string, assistantId: string, opts?: { append?: boolean }) => {
      const s = store.getState();
      const convo = s.conversations.find((c) => c.id === convoId);
      if (!convo) return;
      if (!convo.model) {
        s.updateMessage(convoId, assistantId, {
          streaming: false,
          error: 'No model selected. Pick a model from the top bar.',
        });
        return;
      }

      const controller = new AbortController();
      activeController = controller;
      s.setGenerating(convoId);

      // History = everything up to (but not including) the assistant message,
      // unless we are continuing, in which case keep the partial assistant text.
      const idx = convo.messages.findIndex((m) => m.id === assistantId);
      const history = opts?.append
        ? convo.messages.slice(0, idx + 1)
        : convo.messages.slice(0, idx);

      const startedAt = Date.now();
      try {
        await streamChat(
          {
            model: convo.model,
            messages: toApiMessages(history, convo.systemPrompt),
            options: toApiOptions(convo.params),
          },
          {
            onDelta: (delta) => store.getState().appendToMessage(convoId, assistantId, delta),
            onDone: (final) => {
              store.getState().updateMessage(convoId, assistantId, {
                streaming: false,
                metrics: metricsFromChunk(final, startedAt),
              });
            },
          },
          controller.signal,
        );
      } catch (err) {
        const apiErr = ApiError.from(err);
        const cur = store
          .getState()
          .conversations.find((c) => c.id === convoId)
          ?.messages.find((m) => m.id === assistantId);
        if (apiErr.kind === 'aborted') {
          // Keep whatever was streamed; just mark it finished.
          store.getState().updateMessage(convoId, assistantId, {
            streaming: false,
            metrics: cur?.content ? { responseTimeMs: Date.now() - startedAt } : undefined,
          });
        } else {
          store.getState().updateMessage(convoId, assistantId, {
            streaming: false,
            error: apiErr.userMessage,
          });
        }
      } finally {
        if (activeController === controller) activeController = null;
        store.getState().setGenerating(null);
      }
    },
    [store],
  );

  const send = useCallback(
    async (text: string, attachments: Attachment[] = []) => {
      if (!conversationId) return;
      const trimmed = text.trim();
      if (!trimmed && attachments.length === 0) return;

      const s = store.getState();
      const convo = s.conversations.find((c) => c.id === conversationId);
      if (!convo) return;

      const userMsg: Message = {
        id: uid(),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
        attachments: attachments.length ? attachments : undefined,
      };
      s.addMessage(conversationId, userMsg);

      // Auto-title on first user turn.
      if (convo.title === 'New chat' && convo.messages.length === 0) {
        s.renameConversation(conversationId, deriveTitle(trimmed));
      }

      const assistantMsg: Message = {
        id: uid(),
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        model: convo.model,
        streaming: true,
      };
      s.addMessage(conversationId, assistantMsg);
      s.pushRecentModel(convo.model);

      await runStream(conversationId, assistantMsg.id);
    },
    [conversationId, runStream, store],
  );

  const regenerate = useCallback(
    async (assistantId: string) => {
      if (!conversationId) return;
      const s = store.getState();
      // Reset the assistant message content and re-stream.
      s.updateMessage(conversationId, assistantId, {
        content: '',
        error: undefined,
        streaming: true,
        metrics: undefined,
      });
      await runStream(conversationId, assistantId);
    },
    [conversationId, runStream, store],
  );

  const continueGeneration = useCallback(
    async (assistantId: string) => {
      if (!conversationId) return;
      store.getState().updateMessage(conversationId, assistantId, { streaming: true });
      await runStream(conversationId, assistantId, { append: true });
    },
    [conversationId, runStream, store],
  );

  /** Edit a user message: replace its content, drop later messages, re-ask. */
  const editUserMessage = useCallback(
    async (userMsgId: string, newContent: string) => {
      if (!conversationId) return;
      const s = store.getState();
      s.updateMessage(conversationId, userMsgId, { content: newContent.trim() });
      s.truncateFrom(conversationId, userMsgId, false); // keep the user msg, drop the rest

      const assistantMsg: Message = {
        id: uid(),
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        model: s.conversations.find((c) => c.id === conversationId)?.model,
        streaming: true,
      };
      s.addMessage(conversationId, assistantMsg);
      await runStream(conversationId, assistantMsg.id);
    },
    [conversationId, runStream, store],
  );

  return { send, stop, regenerate, continueGeneration, editUserMessage };
}
