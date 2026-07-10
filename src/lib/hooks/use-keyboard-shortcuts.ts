'use client';

import { useEffect } from 'react';

export interface ShortcutHandlers {
  onCommandPalette: () => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onFocusSearch: () => void;
  onStop: () => void;
}

/**
 * Global keyboard shortcuts:
 *   Ctrl/Cmd+K       — command palette
 *   Ctrl/Cmd+B       — toggle sidebar
 *   Ctrl/Cmd+Shift+O — new chat
 *   Ctrl/Cmd+F       — focus chat search (when not in a text field)
 *   Escape           — stop generation
 * (Ctrl+Enter send is handled inside the input for correct focus semantics.)
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handlers.onCommandPalette();
        return;
      }
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handlers.onToggleSidebar();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handlers.onNewChat();
        return;
      }
      if (mod && e.key.toLowerCase() === 'f' && !inField) {
        e.preventDefault();
        handlers.onFocusSearch();
        return;
      }
      if (e.key === 'Escape' && !inField) {
        handlers.onStop();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}
