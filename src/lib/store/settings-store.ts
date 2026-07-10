import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GenerationParams, PromptPreset } from '@/types';
import {
  ACCENT_PRESETS,
  DEFAULT_PARAMS,
  DEFAULT_PRESETS,
  DEFAULT_SYSTEM_PROMPT,
} from './defaults';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface SettingsState {
  theme: ThemeMode;
  accent: string; // one of ACCENT_PRESETS value
  /** User override for the API URL (falls back to env var when empty). */
  apiUrlOverride: string;
  defaultModel: string;
  defaultSystemPrompt: string;
  defaultParams: GenerationParams;
  presets: PromptPreset[];
  animatedBackground: boolean;
  sendOnEnter: boolean; // Enter sends; Shift+Enter newline. If false, Ctrl+Enter sends.
  showTokenCounter: boolean;

  setTheme: (t: ThemeMode) => void;
  setAccent: (a: string) => void;
  setApiUrlOverride: (v: string) => void;
  setDefaultModel: (m: string) => void;
  setDefaultSystemPrompt: (s: string) => void;
  setDefaultParams: (p: Partial<GenerationParams>) => void;
  addPreset: (p: PromptPreset) => void;
  updatePreset: (id: string, patch: Partial<PromptPreset>) => void;
  removePreset: (id: string) => void;
  toggle: (key: 'animatedBackground' | 'sendOnEnter' | 'showTokenCounter') => void;
  importSettings: (data: Partial<SettingsState>) => void;
  reset: () => void;
}

const initial = {
  theme: 'dark' as ThemeMode,
  accent: ACCENT_PRESETS[0]!.value,
  apiUrlOverride: '',
  defaultModel: '',
  defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
  defaultParams: DEFAULT_PARAMS,
  presets: DEFAULT_PRESETS,
  animatedBackground: true,
  sendOnEnter: true,
  showTokenCounter: true,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...initial,
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setApiUrlOverride: (apiUrlOverride) => set({ apiUrlOverride }),
      setDefaultModel: (defaultModel) => set({ defaultModel }),
      setDefaultSystemPrompt: (defaultSystemPrompt) => set({ defaultSystemPrompt }),
      setDefaultParams: (p) =>
        set((s) => ({ defaultParams: { ...s.defaultParams, ...p } })),
      addPreset: (p) => set((s) => ({ presets: [...s.presets, p] })),
      updatePreset: (id, patch) =>
        set((s) => ({
          presets: s.presets.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      removePreset: (id) => set((s) => ({ presets: s.presets.filter((x) => x.id !== id) })),
      toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<SettingsState>),
      importSettings: (data) => set((s) => ({ ...s, ...data })),
      reset: () => set(initial),
    }),
    {
      name: 'ollama-webui:settings',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
