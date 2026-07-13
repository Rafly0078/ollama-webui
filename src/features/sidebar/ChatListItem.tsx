'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import {
  Check,
  Copy,
  Download,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  X,
} from 'lucide-react';
import type { Conversation } from '@/types';
import { useChatStore } from '@/lib/store/chat-store';
import { conversationToMarkdown, downloadText, slugify } from '@/lib/utils/export';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

interface Props {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
}

export function ChatListItem({ conversation, active, onSelect }: Props) {
  const renameConversation = useChatStore((s) => s.renameConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const togglePin = useChatStore((s) => s.togglePin);
  const duplicate = useChatStore((s) => s.duplicateConversation);
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conversation.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Close the menu on outside click/tap.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  // Reset the delete-confirm state whenever the menu is dismissed.
  useEffect(() => {
    if (!menuOpen) setConfirming(false);
  }, [menuOpen]);

  const commit = () => {
    setEditing(false);
    if (draft.trim()) renameConversation(conversation.id, draft);
    else setDraft(conversation.title);
  };

  return (
    <m.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'group/item relative flex items-center gap-1 rounded-md border-2 border-transparent py-1 pl-2.5 pr-1 text-sm transition-colors',
        active ? 'border-border bg-accent/20 text-content shadow-subtle' : 'text-content-muted hover:border-border/30 hover:bg-surface-raised',
      )}
    >
      <button
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
        aria-current={active}
      >
        {conversation.pinned ? (
          <Pin className="h-3.5 w-3.5 shrink-0 text-accent" />
        ) : (
          <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
        )}
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(conversation.title);
                setEditing(false);
              }
            }}
            className="input h-7 flex-1 px-1.5 py-0 text-sm"
          />
        ) : (
          <span
            className="truncate"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {conversation.title}
          </span>
        )}
      </button>

      {/* Overflow menu trigger. Visible by default (touch-friendly); on
          devices with real hover support it stays quiet until the row is
          hovered/focused, so the list reads clean at rest on desktop. */}
      {!editing && (
        <div
          ref={menuRef}
          className="relative shrink-0 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-within:opacity-100 [@media(hover:hover)]:group-hover/item:opacity-100"
        >
          <button
            aria-label="Chat options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-md text-content-subtle transition-colors hover:bg-border/10 hover:text-content"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <m.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                role="menu"
                onClick={(e) => e.stopPropagation()}
                className="popover absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-2xl p-1.5 shadow-card"
              >
                {!confirming ? (
                  <>
                    <MenuRow
                      icon={Pencil}
                      label="Rename"
                      onClick={() => {
                        setDraft(conversation.title);
                        setEditing(true);
                        setMenuOpen(false);
                      }}
                    />
                    <MenuRow
                      icon={conversation.pinned ? PinOff : Pin}
                      label={conversation.pinned ? 'Unpin' : 'Pin'}
                      onClick={() => {
                        togglePin(conversation.id);
                        setMenuOpen(false);
                      }}
                    />
                    <MenuRow
                      icon={Download}
                      label="Export Markdown"
                      onClick={() => {
                        downloadText(
                          `${slugify(conversation.title)}.md`,
                          conversationToMarkdown(conversation),
                          'text/markdown',
                        );
                        toast('Exported as Markdown', 'success');
                        setMenuOpen(false);
                      }}
                    />
                    <MenuRow
                      icon={Copy}
                      label="Duplicate"
                      onClick={() => {
                        duplicate(conversation.id);
                        setMenuOpen(false);
                      }}
                    />
                    <div className="my-1 h-px bg-border" />
                    <MenuRow
                      icon={Trash2}
                      label="Delete"
                      danger
                      onClick={() => setConfirming(true)}
                    />
                  </>
                ) : (
                  <div className="p-1.5">
                    <p className="px-1.5 pb-2 text-xs text-content-muted">Delete this chat?</p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          deleteConversation(conversation.id);
                          setMenuOpen(false);
                        }}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-error/15 text-xs font-medium text-error hover:bg-error/25"
                      >
                        <Check className="h-3.5 w-3.5" /> Delete
                      </button>
                      <button
                        onClick={() => setConfirming(false)}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-content-subtle hover:bg-border/10 hover:text-content"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </m.div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-border/5',
        danger ? 'text-error hover:bg-error/10' : 'text-content',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
