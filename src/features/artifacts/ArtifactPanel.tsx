'use client';

import { useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Download,
  File,
  FileText,
  FileCode,
  FileSpreadsheet,
  Presentation,
  Trash2,
  Eye,
  X,
} from 'lucide-react';
import type { Artifact, ArtifactKind } from '@/lib/tools/types';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

interface Props {
  artifacts: Artifact[];
  onDelete?: (id: string) => void;
}

function kindIcon(kind: ArtifactKind) {
  switch (kind) {
    case 'pdf':
      return <FileText className="h-4 w-4" />;
    case 'docx':
      return <FileText className="h-4 w-4" />;
    case 'pptx':
      return <Presentation className="h-4 w-4" />;
    case 'xlsx':
    case 'csv':
      return <FileSpreadsheet className="h-4 w-4" />;
    case 'html':
    case 'json':
    case 'xml':
    case 'md':
      return <FileCode className="h-4 w-4" />;
    default:
      return <File className="h-4 w-4" />;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ArtifactCard({ artifact, onDelete }: { artifact: Artifact; onDelete?: (id: string) => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const isPreviewable = ['html', 'md', 'txt', 'json', 'xml', 'csv'].includes(artifact.kind);

  const handleDownload = () => {
    if (!artifact.url) return;
    const a = document.createElement('a');
    a.href = artifact.url;
    a.download = artifact.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <>
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="group/art flex items-center gap-3 rounded-xl border-2 border-border bg-surface-raised p-3 shadow-subtle transition-colors hover:border-accent/30"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          {kindIcon(artifact.kind)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-content">{artifact.name}</p>
          <p className="text-[0.7rem] text-content-subtle">
            {artifact.kind.toUpperCase()} · {formatSize(artifact.size)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/art:opacity-100">
          {isPreviewable && artifact.url && (
            <Tooltip label="Preview">
              <button
                onClick={() => setPreviewOpen(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-content-subtle hover:bg-border/5 hover:text-content"
                aria-label="Preview"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          <Tooltip label="Download">
            <button
              onClick={handleDownload}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-content-subtle hover:bg-border/5 hover:text-content"
              aria-label="Download"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          {onDelete && (
            <Tooltip label="Delete">
              <button
                onClick={() => onDelete(artifact.id)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-content-subtle hover:bg-error/10 hover:text-error"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      </m.div>

      {/* Preview modal */}
      <AnimatePresence>
        {previewOpen && artifact.url && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setPreviewOpen(false)}
          >
            <m.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl border-2 border-border bg-surface shadow-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="truncate text-sm font-medium text-content">{artifact.name}</p>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="btn-ghost h-8 w-8 rounded-lg"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="scrollbar-thin overflow-auto" style={{ maxHeight: 'calc(85vh - 56px)' }}>
                {artifact.kind === 'html' ? (
                  <iframe
                    src={artifact.url}
                    className="h-[70vh] w-full border-0"
                    title={artifact.name}
                  />
                ) : (
                  <pre className="p-4 font-mono text-sm text-content whitespace-pre-wrap">
                    {artifact.url.startsWith('data:') ? atob(artifact.url.split(',')[1] ?? '') : 'Preview not available for this format.'}
                  </pre>
                )}
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * ArtifactPanel — collapsible panel showing all artifacts generated in a conversation.
 * Can be used inline in chat or as a side panel.
 */
export function ArtifactPanel({ artifacts, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (artifacts.length === 0) return null;

  return (
    <div className="border-t border-border bg-surface-mid/50">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-border/5"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-accent" />
        ) : (
          <ChevronDown className="h-4 w-4 text-accent" />
        )}
        <span className="text-sm font-medium text-content">
          Artifacts ({artifacts.length})
        </span>
        <span className="text-[0.7rem] text-content-subtle">
          {artifacts.map((a) => a.kind.toUpperCase()).join(', ')}
        </span>
      </button>
      <AnimatePresence>
        {!collapsed && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-4 pb-3">
              {artifacts.map((a) => (
                <ArtifactCard key={a.id} artifact={a} onDelete={onDelete} />
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { ArtifactCard };
