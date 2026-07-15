'use client';

import { useCallback, useRef } from 'react';
import type { Attachment, Message } from '@/types';
import { useChatStore } from '@/lib/store/chat-store';
import { useThinkingStore } from '@/lib/store/thinking-store';
import { ApiError } from '@/lib/api/config';
import { streamChat, chat } from '@/lib/api/client';
import { toApiMessages, toApiOptions, type ChatStreamChunk } from '@/lib/api/types';
import { uid } from '@/lib/utils/id';
import { detectArtifacts } from '@/lib/tools/detect';
import { enrichPatches, extractCodeBlocks } from '@/lib/tools/patch';
import type { Artifact } from '@/lib/tools/types';
import { searchWeb } from '@/lib/search/client';
import { formatSearchContext, mergeSearchResponses, toSources } from '@/lib/search/format';
import { buildPlanMessages, parsePlan, fallbackPlan, type SearchPlan } from '@/lib/search/plan';
import { useToast } from '@/components/ui/toast';

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
  const executingRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  /** Detect artifact directives in a completed message and execute them. */
  const processArtifacts = useCallback(
    async (convoId: string, messageId: string, content: string) => {
      const { requests, cleaned } = detectArtifacts(content);
      if (requests.length === 0) return;
      // Avoid double-execution if already in progress
      if (executingRef.current.has(messageId)) return;
      executingRef.current.add(messageId);

      // Strip artifact blocks from displayed content
      store.getState().updateMessage(convoId, messageId, { content: cleaned });

      const results = await Promise.allSettled(
        requests.map(async (req) => {
          const res = await fetch('/api/tools/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...req, conversationId: convoId, messageId }),
          });
          if (!res.ok) throw new Error(`Tool execution failed (${res.status})`);
          const { artifact } = (await res.json()) as { artifact: Artifact };
          return artifact;
        }),
      );
      const artifacts = results
        .filter((r): r is PromiseFulfilledResult<Artifact> => r.status === 'fulfilled')
        .map((r) => r.value);
      if (artifacts.length > 0) {
        const msg = store.getState().conversations.find((c) => c.id === convoId)?.messages.find((m) => m.id === messageId);
        if (msg) {
          const existing = (msg.metadata?.artifacts as Artifact[]) ?? [];
          store.getState().updateMessage(convoId, messageId, {
            metadata: { ...msg.metadata, artifacts: [...existing, ...artifacts] },
          });
        }
      }
      executingRef.current.delete(messageId);
    },
    [store],
  );

  /**
   * Detect codepatch directives in a completed message and resolve them against
   * the code the assistant wrote earlier in this conversation. Each fence is
   * rewritten in place to embed the fully-patched source, so PatchBlock can
   * render a diff + copyable corrected code without needing conversation
   * context, and it survives reload (content is persisted; metadata is not).
   */
  const processPatches = useCallback(
    (convoId: string, messageId: string, content: string) => {
      if (!content.includes('```codepatch')) return;
      const convo = store.getState().conversations.find((c) => c.id === convoId);
      if (!convo) return;

      // Candidate sources: code blocks from all *earlier* messages, newest
      // first, so a hunk resolves against the most recent version of the code.
      const idx = convo.messages.findIndex((m) => m.id === messageId);
      const priorCode: string[] = [];
      for (let i = idx - 1; i >= 0; i--) {
        for (const block of extractCodeBlocks(convo.messages[i]!.content)) {
          priorCode.push(block.code);
        }
      }

      const { content: enriched, applied } = enrichPatches(content, priorCode);
      if (applied && enriched !== content) {
        store.getState().updateMessage(convoId, messageId, { content: enriched });
      }
    },
    [store],
  );

  const stop = useCallback(() => {
    stopActiveGeneration();
  }, []);

  /** Core streaming routine: streams into an existing assistant message id. */
  const runStream = useCallback(
    async (
      convoId: string,
      assistantId: string,
      opts?: { append?: boolean; searchContext?: string },
    ) => {
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
      // Abort any generation still in flight before taking over the single
      // slot — otherwise a stale controller keeps writing to the store and can
      // no longer be stopped (stopActiveGeneration only holds the latest one).
      activeController?.abort();
      activeController = controller;
      s.setGenerating(convoId);

      // History = everything up to (but not including) the assistant message,
      // unless we are continuing, in which case keep the partial assistant text.
      const idx = convo.messages.findIndex((m) => m.id === assistantId);
      const history = opts?.append
        ? convo.messages.slice(0, idx + 1)
        : convo.messages.slice(0, idx);

      const startedAt = Date.now();
      // Reuse the grounding captured on the first turn so regenerate/continue
      // don't silently answer without the web context the original answer had.
      const assistantMsg = convo.messages[idx];
      const searchContext =
        opts?.searchContext ?? (assistantMsg?.metadata?.searchContext as string | undefined);

      // Build request — the effort level is sent verbatim as Ollama's `think`
      // parameter ("low" | "medium" | "high" | "max") when thinking is enabled.
      const options = toApiOptions(convo.params);
      const thinkingEnabled = convo.thinking?.enabled === true;

      // Stamp the effort level onto the message so the reasoning panel can react
      // to it (e.g. the "max" shimmer) and it survives a reload. Cleared when
      // thinking is off so a regenerate at a lower level doesn't keep a stale one.
      s.updateMessage(convoId, assistantId, {
        metadata: {
          ...assistantMsg?.metadata,
          effort: thinkingEnabled ? convo.thinking.effort : undefined,
        },
      });

      try {
        await streamChat(
          {
            model: convo.model,
            messages: toApiMessages(history, convo.systemPrompt, searchContext),
            options,
            ...(thinkingEnabled ? { think: convo.thinking.effort } : {}),
          },
          {
            onDelta: (delta) => {
              // First answer token ends the agentic-search phase display.
              const m = store.getState().conversations.find((c) => c.id === convoId)?.messages.find((mm) => mm.id === assistantId);
              if (m?.metadata?.searchPhase) {
                store.getState().updateMessage(convoId, assistantId, {
                  metadata: { ...m.metadata, searchPhase: undefined, searching: false },
                });
              }
              store.getState().appendToMessage(convoId, assistantId, delta);
            },
            onThinking: (delta) => store.getState().appendReasoning(convoId, assistantId, delta),
            onDone: (final) => {
              const finalContent = store.getState().conversations.find((c) => c.id === convoId)?.messages.find((m) => m.id === assistantId)?.content ?? '';
              store.getState().updateMessage(convoId, assistantId, {
                streaming: false,
                metrics: metricsFromChunk(final, startedAt),
              });
              // Detect and execute artifact directives after streaming completes
              void processArtifacts(convoId, assistantId, finalContent);
              // Resolve any targeted code-patch directives against earlier code.
              processPatches(convoId, assistantId, finalContent);
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
          // If the model returned an error while thinking was enabled, it
          // likely doesn't support the `think` parameter. Mark it so the UI
          // can disable the toggle and show a tooltip.
          if (thinkingEnabled) {
            const msg = apiErr.message.toLowerCase();
            if (
              msg.includes('think') ||
              msg.includes('unsupported') ||
              msg.includes('unrecognized') ||
              msg.includes('unknown option') ||
              msg.includes('invalid') ||
              apiErr.status === 400
            ) {
              useThinkingStore.getState().markUnsupported(convo.model);
            }
          }
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
    [store, processArtifacts, processPatches],
  );

  /**
   * Agentic web search: plan → search → (return context for the reasoning turn).
   * Returns the formatted search context to feed the streaming answer, or
   * undefined when nothing usable came back. Updates `metadata.searchPhase` as
   * it moves through phases so the UI can show a multi-step indicator.
   *
   * When `thinkingEnabled` is false we skip the planning round-trip entirely and
   * search the raw user text — exactly the old behavior, so no regression.
   */
  const runAgenticSearch = useCallback(
    async (
      convoId: string,
      messageId: string,
      userText: string,
      history: Message[],
      model: string,
      thinkingEnabled: boolean,
    ): Promise<string | undefined> => {
      const setMeta = (patch: Record<string, unknown>) => {
        const msg = store.getState().conversations.find((c) => c.id === convoId)?.messages.find((m) => m.id === messageId);
        store.getState().updateMessage(convoId, messageId, { metadata: { ...msg?.metadata, ...patch } });
      };

      // Phase 1 — plan the search. Only when thinking is on; otherwise fall back
      // to the raw query so weaker/non-thinking models keep working as before.
      let plan: SearchPlan;
      if (thinkingEnabled) {
        setMeta({ searching: true, searchPhase: 'planning' });
        try {
          const raw = await chat({
            model,
            messages: buildPlanMessages(userText, history),
            think: false, // plan JSON must be clean — no reasoning tokens in the body
          });
          plan = parsePlan(raw) ?? fallbackPlan(userText);
        } catch {
          plan = fallbackPlan(userText);
        }
      } else {
        plan = fallbackPlan(userText);
      }

      if (plan.queries.length === 0) {
        setMeta({ searching: false, searchPhase: undefined });
        return undefined;
      }

      // Phase 2 — run the planned queries and merge results.
      setMeta({ searching: true, searchPhase: 'searching', plannedQueries: plan.queries, searchGoal: plan.goal });
      const settled = await Promise.allSettled(plan.queries.map((q) => searchWeb(q)));
      const responses = settled
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof searchWeb>>> => r.status === 'fulfilled')
        .map((r) => r.value);

      if (responses.length === 0) {
        // Every query failed — surface the first rejection to the caller.
        const firstErr = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
        throw firstErr?.reason instanceof Error ? firstErr.reason : new Error('Web search failed');
      }

      const merged = mergeSearchResponses(responses);

      // Phase 3 — hand off to the reasoning turn. `analyzing` marks the moment
      // the model starts thinking over the gathered data (runStream takes over).
      setMeta({
        searching: false,
        searchPhase: 'analyzing',
        sources: toSources(merged),
        searchContext: formatSearchContext(merged),
      });
      return formatSearchContext(merged);
    },
    [store],
  );

  const send = useCallback(
    async (text: string, attachments: Attachment[] = [], webSearch = false) => {
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

      // Auto-title on first user turn. Fall back to the first attachment's name
      // when the turn is attachment-only, so it doesn't stay "New chat" forever.
      if (convo.title === 'New chat' && convo.messages.length === 0) {
        const seed = trimmed || attachments[0]?.name || '';
        s.renameConversation(conversationId, deriveTitle(seed));
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
      if (convo.model) s.pushRecentModel(convo.model);

      // Optional web search. When thinking is available, this is agentic: the
      // model first plans WHAT to search (keywords + goal), we run those
      // queries, then the streaming turn reasons over the results. A search
      // failure is non-fatal — we toast and let the model answer without it.
      let searchContext: string | undefined;
      if (webSearch && trimmed) {
        const thinkingEnabled = convo.thinking?.enabled === true && !!convo.model;
        try {
          searchContext = await runAgenticSearch(
            conversationId,
            assistantMsg.id,
            trimmed,
            convo.messages,
            convo.model,
            thinkingEnabled,
          );
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Web search failed', 'error');
          store.getState().updateMessage(conversationId, assistantMsg.id, {
            metadata: { searchPhase: undefined, searching: false },
          });
        }
      }

      await runStream(conversationId, assistantMsg.id, { searchContext });
    },
    [conversationId, runStream, runAgenticSearch, store, toast],
  );

  const regenerate = useCallback(
    async (assistantId: string) => {
      if (!conversationId) return;
      const s = store.getState();
      // Reset the assistant message content and re-stream. Clear reasoning too
      // so a regenerated response doesn't append onto the prior attempt's.
      s.updateMessage(conversationId, assistantId, {
        content: '',
        reasoning: undefined,
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
