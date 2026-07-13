'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { ArrowUp, FileText, Loader2, Paperclip, Square, X, Command } from 'lucide-react';
import type { Attachment } from '@/types';
import { fileToAttachment } from '@/lib/utils/files';
import { estimateTokens } from '@/lib/utils/format';
import { SLASH_COMMANDS } from '@/lib/store/defaults';
import { useSettings } from '@/lib/store/settings-store';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';
import { DocumentEditDialog } from '@/features/documents/DocumentEditDialog';

interface Props {
  disabled?: boolean;
  generating: boolean;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  onSlashCommand: (command: string) => void;
  visionCapable?: boolean;
  conversationId?: string | null;
}

const MAX_TEXTAREA_PX = 220;

export function ChatInput({
  disabled,
  generating,
  onSend,
  onStop,
  onSlashCommand,
  visionCapable,
  conversationId,
}: Props) {
  const [docEditOpen, setDocEditOpen] = useState(false);
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const { toast } = useToast();
  const sendOnEnter = useSettings((s) => s.sendOnEnter);
  const showTokenCounter = useSettings((s) => s.showTokenCounter);

  const slashOpen = value.startsWith('/') && !value.includes(' ');
  const slashMatches = slashOpen
    ? SLASH_COMMANDS.filter((c) => c.command.startsWith(value.toLowerCase()))
    : [];

  // Auto-grow the textarea.
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, []);

  useEffect(() => resize(), [value, resize]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setBusy(true);
      const next: Attachment[] = [];
      for (const file of Array.from(files)) {
        try {
          next.push(await fileToAttachment(file));
        } catch (err) {
          toast(err instanceof Error ? err.message : `Couldn't attach ${file.name}`, 'error');
        }
      }
      if (next.length) setAttachments((a) => [...a, ...next]);
      setBusy(false);
    },
    [toast],
  );

  const submit = useCallback(() => {
    if (disabled || generating) return;
    const trimmed = value.trim();

    // Slash command dispatch (commands without inline templates run actions).
    if (slashOpen) {
      const cmd = SLASH_COMMANDS.find((c) => c.command === trimmed);
      if (cmd) {
        if (cmd.template) {
          onSend(cmd.template, []);
        } else {
          onSlashCommand(cmd.command);
        }
        setValue('');
        return;
      }
    }

    if (!trimmed && attachments.length === 0) return;
    onSend(trimmed, attachments);
    setValue('');
    setAttachments([]);
  }, [disabled, generating, value, slashOpen, attachments, onSend, onSlashCommand]);

  const runCommand = useCallback(
    (cmd: (typeof SLASH_COMMANDS)[number]) => {
      if (cmd.template) {
        onSend(cmd.template, []);
      } else {
        onSlashCommand(cmd.command);
      }
      setValue('');
    },
    [onSend, onSlashCommand],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd+Enter always sends. Enter sends when sendOnEnter is on.
    if (e.key === 'Enter') {
      const wantSend = (e.metaKey || e.ctrlKey) || (sendOnEnter && !e.shiftKey);
      if (wantSend) {
        e.preventDefault();
        // Autocomplete a lone slash match directly — don't setValue then submit
        // on the next frame, which would read the stale (pre-setValue) closure.
        if (slashOpen && slashMatches.length === 1 && slashMatches[0]) {
          runCommand(slashMatches[0]);
        } else {
          submit();
        }
      }
    }
    if (e.key === 'Escape' && generating) onStop();
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const imageItems = Array.from(e.clipboardData.items).filter((i) =>
      i.type.startsWith('image/'),
    );
    if (imageItems.length) {
      e.preventDefault();
      const files = imageItems.map((i) => i.getAsFile()).filter(Boolean) as File[];
      void addFiles(files);
    }
  };

  // Drag & drop with a counter so nested dragenter/leave don't flicker.
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  };

  const tokenCount = estimateTokens(value);

  return (
    <div className="chat-container relative pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-5">
      {/* Slash command palette */}
      <AnimatePresence>
        {slashOpen && slashMatches.length > 0 && (
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="popover absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-2xl shadow-card sm:left-6 sm:right-6"
          >
            {slashMatches.map((c) => (
              <button
                key={c.command}
                onClick={() => runCommand(c)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-border/5"
              >
                <Command className="h-4 w-4 text-accent" />
                <span className="font-mono text-sm text-content">{c.command}</span>
                <span className="truncate text-xs text-content-muted">{c.description}</span>
              </button>
            ))}
          </m.div>
        )}
      </AnimatePresence>

      <div
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'popover relative rounded-md p-2 shadow-card transition-colors',
          dragging && 'ring-2 ring-accent',
        )}
      >
        {/* Drag overlay */}
        <AnimatePresence>
          {dragging && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-accent/15"
            >
              <p className="text-sm font-medium text-accent">Drop files to attach</p>
            </m.div>
          )}
        </AnimatePresence>

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="group/att relative flex items-center gap-2 rounded-xl border border-border bg-border/5 py-1 pl-1 pr-2 text-xs"
              >
                {a.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.previewUrl} alt={a.name} className="h-9 w-9 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-border/5">
                    <Paperclip className="h-4 w-4 text-content-muted" />
                  </span>
                )}
                <span className="max-w-[120px] truncate text-content-muted">{a.name}</span>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                  className="rounded-md p-0.5 text-content-subtle hover:text-error"
                  aria-label={`Remove ${a.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <Tooltip label="Attach files (images, PDF, text)">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-content-muted transition-colors hover:bg-accent/20 hover:text-content disabled:opacity-40"
              aria-label="Attach files"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            </button>
          </Tooltip>
          <Tooltip label="Edit a document with AI">
            <button
              onClick={() => setDocEditOpen(true)}
              disabled={disabled}
              className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-content-muted transition-colors hover:bg-accent/20 hover:text-content disabled:opacity-40"
              aria-label="Document editor"
            >
              <FileText className="h-5 w-5" />
            </button>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md,.csv,.json,.log,text/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            disabled={disabled}
            rows={1}
            placeholder={
              disabled ? 'Select a model to start chatting…' : 'Message your model…  (/ for commands)'
            }
            aria-label="Message input"
            className="scrollbar-thin max-h-[220px] flex-1 resize-none bg-transparent py-2.5 text-[0.95rem] leading-6 text-content outline-none placeholder:text-content-subtle disabled:opacity-50"
          />

          {generating ? (
            <Tooltip label="Stop generating (Esc)">
              <button
                onClick={onStop}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-[3px] border-border bg-surface-raised text-content shadow-subtle transition-colors hover:bg-surface-overlay"
                aria-label="Stop generating"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={submit}
              disabled={disabled || (!value.trim() && attachments.length === 0)}
              className="btn-primary h-11 w-11 shrink-0 rounded-md p-0"
              aria-label="Send message"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between px-2 text-[0.7rem] text-content-subtle">
        <span>
          {visionCapable ? 'Vision model — images supported' : 'Text model'}
        </span>
        {showTokenCounter && value.trim() && <span className="tabular-nums">~{tokenCount} tokens</span>}
      </div>

      <DocumentEditDialog
        open={docEditOpen}
        onClose={() => setDocEditOpen(false)}
        conversationId={conversationId ?? null}
      />
    </div>
  );
}
