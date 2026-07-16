'use client';

/**
 * Bridges the local chat store to Supabase for signed-in users.
 *
 *  - On sign-in: load remote conversations and replace the store. If the user
 *    has local (guest) conversations and no remote ones, migrate them up once.
 *  - While signed in: debounced diff-sync — upsert changed conversations,
 *    delete removed ones. Streaming deltas don't bump updatedAt, so we don't
 *    write on every token; the save fires when a turn completes.
 *  - Guest / unconfigured: no-op. The store's localStorage persistence stands.
 */

import { useEffect, useRef } from 'react';
import type { Conversation } from '@/types';
import { useChatStore } from '@/lib/store/chat-store';
import { useAuth } from './AuthProvider';
import {
  deleteConversation as deleteRemote,
  loadConversations,
  saveConversation,
} from '@/lib/services/conversations.service';

const DEBOUNCE_MS = 800;

export function useChatSync(): void {
  const { user, isAuthenticated, isGuest, loading } = useAuth();
  // Sync for any real session (authenticated OR anonymous guest with a row).
  const active = Boolean(user) && !loading;
  const userId = user?.id ?? null;

  // Snapshot of what we believe is persisted, keyed by id → updatedAt.
  const persisted = useRef<Map<string, number>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedFor = useRef<string | null>(null);
  // Guards against overlapping debounced flushes (see below).
  const flushing = useRef(false);
  const dirty = useRef(false);

  // Initial hydrate on (re)login.
  useEffect(() => {
    if (!active || !userId) return;
    if (hydratedFor.current === userId) return;
    hydratedFor.current = userId;

    let cancelled = false;
    (async () => {
      try {
        const remote = await loadConversations();
        if (cancelled) return;

        const localConvos = useChatStore.getState().conversations;
        if (remote.length === 0 && localConvos.length > 0) {
          // First sign-in with local guest history: push it up.
          for (const c of localConvos) {
            try {
              await saveConversation(c, userId);
            } catch {
              /* best-effort per conversation */
            }
          }
          persisted.current = new Map(localConvos.map((c) => [c.id, c.updatedAt]));
          return;
        }

        useChatStore.getState().importConversations(remote, true);
        persisted.current = new Map(remote.map((c) => [c.id, c.updatedAt]));
      } catch {
        // Network/RLS error — leave local state as-is.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, userId]);

  // Reset hydration marker when the user changes / signs out.
  useEffect(() => {
    if (!user) {
      hydratedFor.current = null;
      persisted.current = new Map();
    }
  }, [user, isAuthenticated, isGuest]);

  // Debounced diff-sync on store changes.
  useEffect(() => {
    if (!active || !userId) return;

    const flush = async () => {
      // Guard against overlapping flushes — a debounce that fires while a
      // previous flush is still running would read the same snapshot and
      // duplicate every write. Instead, mark that we're dirty and re-run
      // after the current flush completes.
      if (flushing.current) {
        dirty.current = true;
        return;
      }
      flushing.current = true;

      try {
        const convos = useChatStore.getState().conversations;
        const seen = new Set<string>();
        const known = persisted.current;

        // Upsert new/changed.
        const changed: Conversation[] = [];
        for (const c of convos) {
          seen.add(c.id);
          const prev = known.get(c.id);
          if (prev === undefined || prev !== c.updatedAt) changed.push(c);
        }
        // Delete removed.
        const removed: string[] = [];
        for (const id of known.keys()) if (!seen.has(id)) removed.push(id);

        for (const c of changed) {
          try {
            await saveConversation(c, userId);
            known.set(c.id, c.updatedAt);
          } catch {
            /* retry next flush */
          }
        }
        for (const id of removed) {
          try {
            await deleteRemote(id);
            known.delete(id);
          } catch {
            /* retry next flush */
          }
        }
      } finally {
        flushing.current = false;
        // If the store changed during the flush, schedule another one.
        if (dirty.current) {
          dirty.current = false;
          timer.current = setTimeout(flush, DEBOUNCE_MS);
        }
      }
    };

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, DEBOUNCE_MS);
    };

    const unsub = useChatStore.subscribe(schedule);
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active, userId]);
}
