/**
 * Shared domain types for the whole app. Kept framework-agnostic so both the
 * API layer and the UI can depend on them without circular imports.
 */

export type Role = 'system' | 'user' | 'assistant';

export interface Attachment {
  id: string;
  /** Original filename. */
  name: string;
  /** MIME type, e.g. image/png, application/pdf, text/plain. */
  type: string;
  size: number;
  /** For images: base64 (no data-url prefix) sent to vision models. */
  base64?: string;
  /** For text/pdf: extracted text content inlined into the prompt. */
  text?: string;
  /** Object URL / data URL for local preview only. */
  previewUrl?: string;
}

export interface MessageMetrics {
  /** Wall-clock time from request start to completion, ms. */
  responseTimeMs?: number;
  /** Tokens produced by the model for this response. */
  completionTokens?: number;
  /** Tokens in the prompt. */
  promptTokens?: number;
  /** Tokens per second during generation. */
  tokensPerSecond?: number;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** Present on assistant messages once generation finishes. */
  metrics?: MessageMetrics;
  attachments?: Attachment[];
  /** Model that produced an assistant message (for display). */
  model?: string;
  /** True while the message is actively streaming. */
  streaming?: boolean;
  /** Set when generation failed, holds a user-facing message. */
  error?: string;
}

/** Per-conversation generation parameters. Falls back to global settings. */
export interface GenerationParams {
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  /** Ollama `num_ctx` — context window length. */
  contextLength: number;
  /** Ollama `num_predict` — max tokens to generate. -1 = unlimited. */
  maxTokens: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  systemPrompt: string;
  params: GenerationParams;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface OllamaModelDetails {
  family?: string;
  parameterSize?: string;
  quantizationLevel?: string;
  format?: string;
}

export interface ModelInfo {
  /** Unique model id / tag, e.g. "llama3.2:latest". */
  name: string;
  /** Human label. */
  label: string;
  /** Size on disk in bytes. */
  size?: number;
  /** Context length in tokens if known (from /api/show). */
  contextLength?: number;
  details: OllamaModelDetails;
  /** Whether the model accepts images (vision). */
  supportsVision?: boolean;
}

export interface PromptPreset {
  id: string;
  name: string;
  content: string;
}

export interface SlashCommand {
  command: string;
  description: string;
  /** Text inserted / action performed. */
  template?: string;
}
