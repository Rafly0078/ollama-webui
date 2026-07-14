'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, GitCompareArrows, AlertTriangle } from 'lucide-react';
import { parsePatchBlock, lineDiff, type DiffLine } from '@/lib/tools/patch';
import { cn } from '@/lib/utils/cn';

/**
 * Renders a ```codepatch fence as a red/green line diff plus, when the patch
 * was resolved against earlier code, the full corrected source with a copy
 * button. Shown in place of the raw directive (see MarkdownRenderer). While the
 * message is still streaming we fall back to showing the raw text, since the
 * fence may be incomplete.
 */
export function PatchBlock({ raw, streaming }: { raw: string; streaming: boolean }) {
  const parsed = useMemo(() => parsePatchBlock(raw), [raw]);
  const [copied, setCopied] = useState(false);

  // Still streaming, or unparseable → show raw so nothing looks lost.
  if (streaming || !parsed) {
    return (
      <pre className="code-block scrollbar-thin overflow-x-auto p-4 text-[0.85rem] leading-[1.7] text-white/90">
        <code>{raw}</code>
      </pre>
    );
  }

  const diff: DiffLine[] = parsed.hunks.flatMap((h, i) => {
    const rows = lineDiff(h.search, h.replace);
    // Blank separator between multiple hunks.
    return i === 0 ? rows : [{ kind: 'context' as const, text: '' }, ...rows];
  });

  const copy = async () => {
    if (!parsed.result) return;
    try {
      await navigator.clipboard.writeText(parsed.result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="code-block group/patch my-2">
      <div className="code-block-header">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-white/45">
            {parsed.lang ? `${parsed.lang} patch` : 'code patch'}
          </span>
        </div>
        {parsed.result && (
          <button
            onClick={copy}
            className={cn(
              'focus-ring flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-xs transition-colors',
              copied
                ? 'text-success'
                : 'text-white/55 hover:border-white/[0.12] hover:bg-white/[0.07] hover:text-white/90',
            )}
            aria-label="Copy corrected code"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy fixed code
              </>
            )}
          </button>
        )}
      </div>

      {/* Diff view */}
      <pre className="scrollbar-thin overflow-x-auto py-2 text-[0.85rem] leading-[1.6]">
        {diff.map((line, i) => (
          <div
            key={i}
            className={cn(
              'flex px-4',
              line.kind === 'add' && 'diff-add',
              line.kind === 'remove' && 'diff-remove',
            )}
          >
            <span
              className={cn(
                'mr-3 shrink-0 select-none text-white/30',
                line.kind === 'add' && 'text-success',
                line.kind === 'remove' && 'text-error',
              )}
              aria-hidden="true"
            >
              {line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '}
            </span>
            <code className="whitespace-pre text-white/90">{line.text || ' '}</code>
          </div>
        ))}
      </pre>

      {parsed.unresolved && (
        <div className="flex items-start gap-2 border-t border-white/[0.08] px-4 py-2 text-xs text-amber-400/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Perubahan ini tidak bisa diterapkan otomatis ke kode sebelumnya (potongan aslinya tidak
            ketemu). Terapkan manual sesuai diff di atas.
          </span>
        </div>
      )}
    </div>
  );
}
