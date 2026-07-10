import type { GenerationParams, Message } from '@/types';

/** Wire types matching an Ollama-compatible proxy. */

export interface ApiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** base64-encoded images (no data-url prefix) for vision models. */
  images?: string[];
}

export interface ChatRequest {
  model: string;
  messages: ApiChatMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
    num_ctx?: number;
    num_predict?: number;
  };
}

/** One NDJSON/SSE chunk from a streaming chat response (Ollama shape). */
export interface ChatStreamChunk {
  model?: string;
  message?: { role?: string; content?: string; images?: string[] };
  /** Some proxies use `response` (generate endpoint) instead of message.content. */
  response?: string;
  done?: boolean;
  // Timing/token stats present on the final chunk.
  total_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  prompt_eval_count?: number;
  error?: string;
}

export interface RawModelDetails {
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
  format?: string;
}

export interface RawModel {
  name?: string;
  model?: string;
  size?: number;
  details?: RawModelDetails;
  // /api/show style fields sometimes merged in:
  context_length?: number;
  capabilities?: string[];
}

export interface ModelsResponse {
  models?: RawModel[];
}

/** Map app messages → wire messages, folding attachments into content/images. */
export function toApiMessages(messages: Message[], systemPrompt: string): ApiChatMessage[] {
  const out: ApiChatMessage[] = [];
  if (systemPrompt.trim()) out.push({ role: 'system', content: systemPrompt.trim() });

  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.error) continue;
    const images: string[] = [];
    let content = m.content;

    for (const att of m.attachments ?? []) {
      if (att.base64) images.push(att.base64);
      else if (att.text) {
        content += `\n\n[Attached file: ${att.name}]\n\`\`\`\n${att.text}\n\`\`\``;
      }
    }

    out.push({
      role: m.role,
      content,
      ...(images.length ? { images } : {}),
    });
  }
  return out;
}

export function toApiOptions(p: GenerationParams): ChatRequest['options'] {
  return {
    temperature: p.temperature,
    top_p: p.topP,
    top_k: p.topK,
    repeat_penalty: p.repeatPenalty,
    num_ctx: p.contextLength,
    num_predict: p.maxTokens,
  };
}
