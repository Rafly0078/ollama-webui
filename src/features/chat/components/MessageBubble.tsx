'use client';

import { memo, useState } from 'react';
import { m } from 'framer-motion';
import {
  AlertCircle,
  Check,
  Copy,
  Pencil,
  RefreshCw,
  Trash2,
  User,
  Sparkles,
  CornerDownRight,
  X,
} from 'lucide-react';
import type { Message } from '@/types';
import { Markdown } from '@/components/markdown/Markdown';
import { Tooltip } from '@/components/ui/tooltip';
import { TypingIndicator } from './TypingIndicator';
import { formatDuration, formatNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export interface MessageActions {
  onCopy: (text: string) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onRegenerate: (id: string) => void;
  onContinue: (id: string) => void;
  onRetry: (id: string) => void;
}

interface Props {
  message: Message;
  isLast: boolean;
  generating: boolean;
  actions: MessageActions;
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-border/5 px-1.5 py-0.5 text-[0.68rem] text-content-subtle">
      <span className="font-medium tabular-nums text-content-muted">{value}</span>
      {label}
    </span>
  );
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isLast,
  generating,
  actions,
}: Props) {
  const isUser = message.role === 'user';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    actions.onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const submitEdit = () => {
    setEditing(false);
    if (draft.trim() && draft !== message.content) actions.onEdit(message.id, draft);
  };

  const showActions = !message.streaming && !editing;
  const canContinue = !isUser && isLast && !generating && !message.error && message.content.length > 0;

  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'group/msg chat-container flex gap-3 py-6 sm:gap-4',
        // Native windowing: skip layout/paint for offscreen, settled messages.
        // The live/streaming message stays fully rendered.
        !message.streaming && 'cv-auto',
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-[3px] border-border',
          isUser ? 'bg-surface-overlay text-content shadow-subtle' : 'accent-gradient text-accent-fg shadow-subtle',
        )}
        aria-hidden
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>

      {/* Body */}
      <div className={cn('min-w-0 flex-1', isUser && 'border-[3px] border-border bg-surface-raised px-4 py-3 shadow-card')}>
        <div className="mb-1 flex items-center gap-2 text-xs">
          <span className="font-bold uppercase tracking-[0.08em] text-content">{isUser ? 'You' : 'Ollama'}</span>
          {message.model && !isUser && (
            <span className="rounded-md bg-border/5 px-1.5 py-0.5 font-mono text-[0.68rem] text-content-subtle">
              {message.model.replace(/:latest$/, '')}
            </span>
          )}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.attachments.map((a) =>
              a.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={a.id}
                  src={a.previewUrl}
                  alt={a.name}
                  className="h-24 w-24 rounded-lg border border-border object-cover"
                />
              ) : (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-border/5 px-2 py-1 text-xs text-content-muted"
                >
                  {a.name}
                </span>
              ),
            )}
          </div>
        )}

        {/* Content */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(12, draft.split('\n').length + 1)}
              autoFocus
              className="input resize-none font-sans"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
            <div className="flex gap-2">
              <button onClick={submitEdit} className="btn-primary h-8 px-3 text-xs">
                Save &amp; submit
              </button>
              <button onClick={() => setEditing(false)} className="btn-ghost h-8 px-3 text-xs">
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </div>
        ) : message.error ? (
          <div className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p>{message.error}</p>
              <button
                onClick={() => actions.onRetry(message.id)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-error/10 px-2.5 py-1 text-xs font-medium text-error hover:bg-error/20"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          </div>
        ) : isUser ? (
          <div className="whitespace-pre-wrap break-words text-[0.95rem] leading-7 text-content">
            {message.content}
          </div>
        ) : message.content ? (
          <div className={message.streaming ? 'streaming-caret' : undefined}>
            <Markdown content={message.content} />
          </div>
        ) : message.streaming ? (
          <div className="py-1">
            <TypingIndicator />
          </div>
        ) : null}

        {/* Metrics */}
        {!isUser && message.metrics && !message.streaming && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {message.metrics.tokensPerSecond != null && (
              <MetricPill label="tok/s" value={message.metrics.tokensPerSecond.toFixed(1)} />
            )}
            {message.metrics.completionTokens != null && (
              <MetricPill label="tokens" value={formatNumber(message.metrics.completionTokens)} />
            )}
            {message.metrics.responseTimeMs != null && (
              <MetricPill label="" value={formatDuration(message.metrics.responseTimeMs)} />
            )}
          </div>
        )}

        {/* Action bar. Visible by default so touch users can always reach it —
            only pointers that genuinely support hover (mouse/trackpad) get
            the idle-hidden, hover-to-reveal treatment. */}
        {showActions && (
          <div className="mt-2 flex items-center gap-1 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-within:opacity-100 [@media(hover:hover)]:group-hover/msg:opacity-100">
            <ActionBtn label={copied ? 'Copied' : 'Copy'} onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </ActionBtn>
            {isUser && (
              <ActionBtn label="Edit" onClick={() => { setDraft(message.content); setEditing(true); }}>
                <Pencil className="h-4 w-4" />
              </ActionBtn>
            )}
            {!isUser && (
              <ActionBtn label="Regenerate" onClick={() => actions.onRegenerate(message.id)}>
                <RefreshCw className="h-4 w-4" />
              </ActionBtn>
            )}
            {canContinue && (
              <ActionBtn label="Continue" onClick={() => actions.onContinue(message.id)}>
                <CornerDownRight className="h-4 w-4" />
              </ActionBtn>
            )}
            <ActionBtn label="Delete" onClick={() => actions.onDelete(message.id)}>
              <Trash2 className="h-4 w-4" />
            </ActionBtn>
          </div>
        )}
      </div>
    </m.div>
  );
});

function ActionBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        aria-label={label}
        className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-border/5 hover:text-content active:bg-border/10"
      >
        {children}
      </button>
    </Tooltip>
  );
}
