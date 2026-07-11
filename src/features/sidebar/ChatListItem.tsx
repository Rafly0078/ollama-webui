'use client';

import { useEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { Check, Copy, Download, MessageSquare, Pin, PinOff, Trash2, X } from 'lucide-react';
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
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

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
        'group/item relative flex items-center gap-2 rounded-md border-2 border-transparent px-2.5 py-2 text-sm transition-colors',
        active ? 'border-border bg-accent/20 text-content shadow-subtle' : 'text-content-muted hover:border-border/30 hover:bg-surface-raised',
      )}
    >
      <button
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
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
            className="input h-6 flex-1 px-1.5 py-0 text-sm"
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

      {!editing && !confirming && (
        <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/item:opacity-100">
          <IconBtn
            label={conversation.pinned ? 'Unpin' : 'Pin'}
            onClick={() => togglePin(conversation.id)}
          >
            {conversation.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </IconBtn>
          <IconBtn
            label="Export Markdown"
            onClick={() => {
              downloadText(
                `${slugify(conversation.title)}.md`,
                conversationToMarkdown(conversation),
                'text/markdown',
              );
              toast('Exported as Markdown', 'success');
            }}
          >
            <Download className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label="Duplicate" onClick={() => duplicate(conversation.id)}>
            <Copy className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label="Delete" danger onClick={() => setConfirming(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      )}

      {confirming && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => deleteConversation(conversation.id)}
            className="rounded-md bg-error/20 px-2 py-0.5 text-xs text-error hover:bg-error/30"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="rounded-md px-1 py-0.5 text-content-subtle hover:text-content"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </m.div>
  );
}

function IconBtn({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-border/10',
        danger ? 'text-content-subtle hover:text-error' : 'text-content-subtle hover:text-content',
      )}
    >
      {children}
    </button>
  );
}
