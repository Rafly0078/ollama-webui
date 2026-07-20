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
export type ConnectionMode = 'direct' | 'bridge';

export interface SettingsState {
  theme: ThemeMode;
  accent: string; // one of ACCENT_PRESETS value
  /** User override for the API URL (falls back to env var when empty). */
  apiUrlOverride: string;
  /** 'direct': browser -> Ollama directly (no time limit, needs CORS).
   *  'bridge': browser -> same-origin server proxy -> Ollama (no CORS setup, capped by the host's function duration). */
  connectionMode: ConnectionMode;
  defaultModel: string;
  defaultSystemPrompt: string;
  defaultParams: GenerationParams;
  presets: PromptPreset[];
  animatedBackground: boolean;
  sendOnEnter: boolean; // Enter sends; Shift+Enter newline. If false, Ctrl+Enter sends.
  showTokenCounter: boolean;
  /** Auto-audit web code (HTML/CSS/JS) in a sandbox and let the model fix its
   *  own runtime errors. Off by default — it makes extra model calls. */
  sandboxAutoHeal: boolean;
  /** Max heal iterations per run before giving up. */
  sandboxMaxIterations: number;

  setTheme: (t: ThemeMode) => void;
  setAccent: (a: string) => void;
  setApiUrlOverride: (v: string) => void;
  setConnectionMode: (m: ConnectionMode) => void;
  setDefaultModel: (m: string) => void;
  setDefaultSystemPrompt: (s: string) => void;
  setDefaultParams: (p: Partial<GenerationParams>) => void;
  addPreset: (p: PromptPreset) => void;
  updatePreset: (id: string, patch: Partial<PromptPreset>) => void;
  removePreset: (id: string) => void;
  toggle: (
    key: 'animatedBackground' | 'sendOnEnter' | 'showTokenCounter' | 'sandboxAutoHeal',
  ) => void;
  setSandboxMaxIterations: (n: number) => void;
  importSettings: (data: Partial<SettingsState>) => void;
  reset: () => void;
}

const initial = {
  theme: 'light' as ThemeMode,
  accent: ACCENT_PRESETS[0]!.value,
  apiUrlOverride: '',
  connectionMode: 'direct' as ConnectionMode,
  defaultModel: '',
  defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
  defaultParams: DEFAULT_PARAMS,
  presets: DEFAULT_PRESETS,
  animatedBackground: true,
  sendOnEnter: true,
  showTokenCounter: true,
  sandboxAutoHeal: false,
  sandboxMaxIterations: 3,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...initial,
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setApiUrlOverride: (apiUrlOverride) => set({ apiUrlOverride }),
      setConnectionMode: (connectionMode) => set({ connectionMode }),
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
      setSandboxMaxIterations: (n) =>
        set({ sandboxMaxIterations: Math.max(1, Math.min(8, Math.round(n))) }),
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
