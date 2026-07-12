'use client';

import { useCallback } from 'react';
import type { Artifact, GenerateRequest, ToolName } from '@/lib/tools/types';
import { detectArtifacts, hasCompleteDirective } from '@/lib/tools/detect';
import { useChatStore } from '@/lib/store/chat-store';

/**
 * Hook for detecting and executing artifact directives in assistant messages.
 * When the assistant emits a ```artifact block, this hook:
 * 1. Detects the directive
 * 2. POSTs to /api/tools/execute
 * 3. Stores the resulting Artifact in the message's metadata
 */
export function useArtifactEngine(conversationId: string | null) {
  const updateMessage = useChatStore((s) => s.updateMessage);

  const executeArtifacts = useCallback(
    async (messageId: string, content: string) => {
      if (!conversationId) return;

      const { requests, cleaned } = detectArtifacts(content);
      if (requests.length === 0) return;

      // Update the message content with artifact blocks stripped
      updateMessage(conversationId, messageId, { content: cleaned });

      // Execute each artifact request
      for (const req of requests) {
        try {
          const res = await fetch('/api/tools/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...req,
              conversationId,
              messageId,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Execution failed' }));
            console.error('Artifact execution failed:', err);
            continue;
          }

          const { artifact } = (await res.json()) as { artifact: Artifact };

          // Store artifact in the message metadata
          const convo = useChatStore.getState().conversations.find((c) => c.id === conversationId);
          const msg = convo?.messages.find((m) => m.id === messageId);
          if (msg) {
            const existingArtifacts = (msg.metadata?.artifacts as Artifact[]) ?? [];
            updateMessage(conversationId, messageId, {
              metadata: {
                ...msg.metadata,
                artifacts: [...existingArtifacts, artifact],
              },
            });
          }
        } catch (err) {
          console.error('Artifact execution error:', err);
        }
      }
    },
    [conversationId, updateMessage],
  );

  const checkAndExecute = useCallback(
    (messageId: string, content: string) => {
      if (hasCompleteDirective(content)) {
        void executeArtifacts(messageId, content);
      }
    },
    [executeArtifacts],
  );

  return { executeArtifacts, checkAndExecute };
}
