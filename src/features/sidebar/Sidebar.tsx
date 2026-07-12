'use client';

import { useMemo } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import Link from 'next/link';
import { Plus, Search, Settings2, X } from 'lucide-react';
import { useChatStore } from '@/lib/store/chat-store';
import { useSettings } from '@/lib/store/settings-store';
import { ChatListItem } from './ChatListItem';
import { dateBucket } from '@/lib/utils/format';
import type { Conversation } from '@/types';
import { useIsMobile } from '@/lib/hooks/use-media-query';

interface Props {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
}

const SIDEBAR_WIDTH = 288;

export function Sidebar({ open, onClose, onNewChat }: Props) {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const setActive = useChatStore((s) => s.setActive);
  const query = useChatStore((s) => s.searchQuery);
  const setQuery = useChatStore((s) => s.setSearchQuery);
  const defaultModel = useSettings((s) => s.defaultModel);
  const isMobile = useIsMobile();

  const { pinned, groups } = useMemo(() => filterAndGroup(conversations, query), [conversations, query]);

  const select = (id: string) => {
    setActive(id);
    if (isMobile) onClose();
  };

  const content = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="accent-gradient flex h-10 w-10 items-center justify-center rounded-md border-[3px] border-border shadow-card">
          <span>
            <img src="/noun-atom-8300355 (1).png" alt="Logo" className="h-6 w-6" />
          </span>
        </div>
        <span className="flex-1 text-lg font-bold uppercase tracking-[-0.06em] text-content">AI Chat</span>
        {isMobile && (
          <button onClick={onClose} className="btn-ghost h-8 w-8 rounded-lg" aria-label="Close sidebar">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* New chat */}
      <div className="px-4">
        <button onClick={onNewChat} className="btn-primary h-11 w-full rounded-md">
          <Plus className="h-4 w-4" /> New chat
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
          <input
            id="sidebar-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            aria-label="Search conversations"
            className="input h-9 pl-9 pr-8"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-content-subtle hover:text-content"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-3" aria-label="Conversations">
        {conversations.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-content-subtle">
            No conversations yet. Start a new chat to begin.
          </p>
        )}
        {conversations.length > 0 && pinned.length === 0 && groups.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-content-subtle">
            No chats match “{query}”.
          </p>
        )}

        <AnimatePresence initial={false}>
          {pinned.length > 0 && (
            <Section key="pinned" title="Pinned">
              {pinned.map((c) => (
                <ChatListItem
                  key={c.id}
                  conversation={c}
                  active={c.id === activeId}
                  onSelect={() => select(c.id)}
                />
              ))}
            </Section>
          )}
          {groups.map(([bucket, items]) => (
            <Section key={bucket} title={bucket}>
              {items.map((c) => (
                <ChatListItem
                  key={c.id}
                  conversation={c}
                  active={c.id === activeId}
                  onSelect={() => select(c.id)}
                />
              ))}
            </Section>
          ))}
        </AnimatePresence>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-3 py-3">
        <Link href="/settings" className="btn-ghost h-9 w-full justify-start">
          <Settings2 className="h-4 w-4" /> Settings
        </Link>
        <p className="mt-2 px-2 text-[0.68rem] text-content-subtle">
          {defaultModel ? `Default: ${defaultModel}` : 'Local models • private by design'}
        </p>
      </div>
    </div>
  );

  // Mobile: overlay drawer. Desktop: collapsible inline panel.
  if (isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <>
            <m.div
              className="fixed inset-0 z-40 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <m.aside
              initial={{ x: -SIDEBAR_WIDTH }}
              animate={{ x: 0 }}
              exit={{ x: -SIDEBAR_WIDTH }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="popover fixed inset-y-0 left-0 z-50 w-72 border-r border-border"
            >
              {content}
            </m.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop: instant open/close (the brief asks for instant, and animating
  // `width` is disallowed). The slot is present only when open; the inner
  // content gets a subtle transform/opacity entrance — no layout animation.
  if (!open) return null;
  return (
    <aside
      className="glass relative z-20 h-full shrink-0 overflow-hidden border-0 motion-safe:animate-fade-in"
      style={{ width: SIDEBAR_WIDTH }}
    >
      {content}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-wide text-content-subtle">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function filterAndGroup(conversations: Conversation[], query: string) {
  const q = query.trim().toLowerCase();
  const matches = conversations.filter((c) => {
    if (!q) return true;
    if (c.title.toLowerCase().includes(q)) return true;
    return c.messages.some((m) => m.content.toLowerCase().includes(q));
  });

  const pinned = matches
    .filter((c) => c.pinned)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const unpinned = matches
    .filter((c) => !c.pinned)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const bucketMap = new Map<string, Conversation[]>();
  for (const c of unpinned) {
    const bucket = dateBucket(c.updatedAt);
    const arr = bucketMap.get(bucket) ?? [];
    arr.push(c);
    bucketMap.set(bucket, arr);
  }

  return { pinned, groups: Array.from(bucketMap.entries()) };
}
