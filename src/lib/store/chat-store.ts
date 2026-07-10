import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Conversation, GenerationParams, Message } from '@/types';
import { uid } from '@/lib/utils/id';
import { DEFAULT_PARAMS, DEFAULT_SYSTEM_PROMPT } from './defaults';

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  /** Conversation id currently generating (null when idle). */
  generatingId: string | null;
  searchQuery: string;
  recentModels: string[];

  // selectors are derived in components; these are the mutations
  createConversation: (opts?: Partial<Pick<Conversation, 'model' | 'systemPrompt' | 'params'>>) => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  setActive: (id: string | null) => void;
  clearMessages: (id: string) => void;
  duplicateConversation: (id: string) => void;

  setConversationModel: (id: string, model: string) => void;
  setConversationSystemPrompt: (id: string, prompt: string) => void;
  setConversationParams: (id: string, patch: Partial<GenerationParams>) => void;

  addMessage: (convoId: string, msg: Message) => void;
  appendToMessage: (convoId: string, msgId: string, delta: string) => void;
  updateMessage: (convoId: string, msgId: string, patch: Partial<Message>) => void;
  deleteMessage: (convoId: string, msgId: string) => void;
  /** Remove a message and everything after it (used by regenerate/edit). */
  truncateFrom: (convoId: string, msgId: string, inclusive: boolean) => void;

  setGenerating: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  pushRecentModel: (model: string) => void;

  importConversations: (data: Conversation[], replace?: boolean) => void;
}

function touch(convo: Conversation): Conversation {
  return { ...convo, updatedAt: Date.now() };
}

export function makeConversation(
  opts?: Partial<Pick<Conversation, 'model' | 'systemPrompt' | 'params'>>,
): Conversation {
  const now = Date.now();
  return {
    id: uid(),
    title: 'New chat',
    messages: [],
    model: opts?.model ?? '',
    systemPrompt: opts?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    params: opts?.params ?? { ...DEFAULT_PARAMS },
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversations: [],
      activeId: null,
      generatingId: null,
      searchQuery: '',
      recentModels: [],

      createConversation: (opts) => {
        const convo = makeConversation(opts);
        set((s) => ({ conversations: [convo, ...s.conversations], activeId: convo.id }));
        return convo.id;
      },

      deleteConversation: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id);
          const activeId =
            s.activeId === id ? (conversations[0]?.id ?? null) : s.activeId;
          return { conversations, activeId };
        }),

      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? touch({ ...c, title: title.trim() || 'Untitled' }) : c,
          ),
        })),

      togglePin: (id) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, pinned: !c.pinned } : c,
          ),
        })),

      setActive: (activeId) => set({ activeId }),

      clearMessages: (id) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? touch({ ...c, messages: [] }) : c,
          ),
        })),

      duplicateConversation: (id) =>
        set((s) => {
          const src = s.conversations.find((c) => c.id === id);
          if (!src) return s;
          const copy: Conversation = {
            ...src,
            id: uid(),
            title: `${src.title} (copy)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            pinned: false,
            messages: src.messages.map((m) => ({ ...m, id: uid() })),
          };
          return { conversations: [copy, ...s.conversations], activeId: copy.id };
        }),

      setConversationModel: (id, model) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? touch({ ...c, model }) : c,
          ),
        })),

      setConversationSystemPrompt: (id, systemPrompt) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? touch({ ...c, systemPrompt }) : c,
          ),
        })),

      setConversationParams: (id, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? touch({ ...c, params: { ...c.params, ...patch } }) : c,
          ),
        })),

      addMessage: (convoId, msg) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convoId ? touch({ ...c, messages: [...c.messages, msg] }) : c,
          ),
        })),

      appendToMessage: (convoId, msgId, delta) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convoId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, content: m.content + delta } : m,
                  ),
                }
              : c,
          ),
        })),

      updateMessage: (convoId, msgId, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convoId
              ? touch({
                  ...c,
                  messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
                })
              : c,
          ),
        })),

      deleteMessage: (convoId, msgId) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convoId
              ? touch({ ...c, messages: c.messages.filter((m) => m.id !== msgId) })
              : c,
          ),
        })),

      truncateFrom: (convoId, msgId, inclusive) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== convoId) return c;
            const idx = c.messages.findIndex((m) => m.id === msgId);
            if (idx === -1) return c;
            const end = inclusive ? idx : idx + 1;
            return touch({ ...c, messages: c.messages.slice(0, end) });
          }),
        })),

      setGenerating: (generatingId) => set({ generatingId }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      pushRecentModel: (model) =>
        set((s) => ({
          recentModels: [model, ...s.recentModels.filter((m) => m !== model)].slice(0, 6),
        })),

      importConversations: (data, replace) =>
        set((s) => ({
          conversations: replace ? data : [...data, ...s.conversations],
          activeId: data[0]?.id ?? s.activeId,
        })),
    }),
    {
      name: 'ollama-webui:chats',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Don't persist transient generation state.
      partialize: (s) => ({
        conversations: s.conversations,
        activeId: s.activeId,
        recentModels: s.recentModels,
      }),
    },
  ),
);
