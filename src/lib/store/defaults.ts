import type { GenerationParams, PromptPreset, SlashCommand } from '@/types';
import { uid } from '@/lib/utils/id';

export const DEFAULT_PARAMS: GenerationParams = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  contextLength: 4096,
  maxTokens: -1,
};

export const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful, knowledgeable AI assistant. Answer clearly and concisely. Use Markdown for formatting, fenced code blocks with language tags, LaTeX for math, and tables where helpful.';

export const ACCENT_PRESETS: { name: string; value: string; rgb: string; soft: string }[] = [
  { name: 'Violet', value: 'violet', rgb: '124 58 237', soft: '168 85 247' }, // #7C3AED / #A855F7
  { name: 'Blue', value: 'blue', rgb: '37 99 235', soft: '96 165 250' },
  { name: 'Emerald', value: 'emerald', rgb: '5 150 105', soft: '52 211 153' },
  { name: 'Rose', value: 'rose', rgb: '225 29 72', soft: '251 113 133' },
  { name: 'Amber', value: 'amber', rgb: '217 119 6', soft: '251 191 36' },
  { name: 'Cyan', value: 'cyan', rgb: '8 145 178', soft: '34 211 238' },
];

export const DEFAULT_PRESETS: PromptPreset[] = [
  { id: uid(), name: 'Default Assistant', content: DEFAULT_SYSTEM_PROMPT },
  {
    id: uid(),
    name: 'Senior Engineer',
    content:
      'You are a senior software engineer. Give production-quality, idiomatic code with brief rationale. Prefer correctness and clarity. Point out edge cases.',
  },
  {
    id: uid(),
    name: 'Concise',
    content: 'Answer in as few words as possible. No preamble. Bullet points where useful.',
  },
];

export const PROMPT_SUGGESTIONS: { title: string; subtitle: string; prompt: string }[] = [
  {
    title: 'Explain a concept',
    subtitle: 'Break down something complex',
    prompt: 'Explain how HTTPS works, step by step, to a junior developer.',
  },
  {
    title: 'Write code',
    subtitle: 'Generate a function or component',
    prompt: 'Write a debounce hook in TypeScript for React with full types.',
  },
  {
    title: 'Draft & refine',
    subtitle: 'Improve some text',
    prompt: 'Rewrite this to be more concise and professional: "..."',
  },
  {
    title: 'Plan something',
    subtitle: 'Get a structured breakdown',
    prompt: 'Give me a 1-week learning plan for Rust, assuming I know Go.',
  },
];

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/system', description: 'Edit the system prompt for this chat' },
  { command: '/clear', description: 'Clear all messages in this chat' },
  { command: '/params', description: 'Open generation parameters' },
  { command: '/model', description: 'Switch the active model' },
  { command: '/export', description: 'Export this conversation' },
  {
    command: '/summarize',
    description: 'Summarize the conversation so far',
    template: 'Summarize our conversation so far into concise bullet points.',
  },
  {
    command: '/explain',
    description: 'Explain the previous answer more simply',
    template: 'Explain your previous answer more simply, as if to a beginner.',
  },
];
