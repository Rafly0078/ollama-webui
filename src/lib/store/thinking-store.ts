import { create } from 'zustand';

/**
 * Tracks which models have returned an error when `think: true` was sent, so
 * the UI can disable the thinking toggle for them and show a tooltip.
 *
 * Non-persistent: this is a per-session cache. A model might gain thinking
 * support after an Ollama update; a page refresh clears the blocklist so it
 * can be re-tried.
 */
interface ThinkingState {
  /** Model names known to not support thinking. */
  unsupported: Set<string>;

  /** Mark a model as not supporting thinking. */
  markUnsupported: (model: string) => void;
  /** Clear the unsupported flag for a model (e.g. after an update). */
  clearUnsupported: (model: string) => void;
  /** Check if a model is known to not support thinking. */
  isUnsupported: (model: string) => boolean;
}

export const useThinkingStore = create<ThinkingState>((set, get) => ({
  unsupported: new Set<string>(),

  markUnsupported: (model) =>
    set((s) => {
      if (s.unsupported.has(model)) return s;
      const next = new Set(s.unsupported);
      next.add(model);
      return { unsupported: next };
    }),

  clearUnsupported: (model) =>
    set((s) => {
      if (!s.unsupported.has(model)) return s;
      const next = new Set(s.unsupported);
      next.delete(model);
      return { unsupported: next };
    }),

  isUnsupported: (model) => get().unsupported.has(model),
}));
