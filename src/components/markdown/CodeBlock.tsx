'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Code block wrapper with a language badge and copy button. The inner <code>
 * is already highlighted by rehype-highlight; this adds the chrome.
 */
export function CodeBlock({
  language,
  raw,
  children,
  className,
}: {
  language?: string;
  raw: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={cn('group/code my-4 overflow-hidden rounded-xl border border-border bg-black/40', className)}>
      <div className="flex items-center justify-between border-b border-border bg-border/[0.03] px-3 py-1.5">
        <span className="font-mono text-xs text-content-subtle">{language || 'text'}</span>
        <button
          onClick={copy}
          className="focus-ring flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-content-muted transition-colors hover:bg-border/5 hover:text-content"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-success" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="scrollbar-thin overflow-x-auto p-4 text-[0.85rem] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}
