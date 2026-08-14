/** AI provider abstraction — multi-provider support. */

export type ProviderType = 'anthropic' | 'openai' | 'gemini';

export interface AIProviderConfig {
  provider: ProviderType;
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface AIProvider {
  validate(): Promise<boolean>;
  generate(prompt: string, opts?: { signal?: AbortSignal }): Promise<string>;
}

export const PROVIDER_DEFAULTS: Record<ProviderType, { baseUrl: string; model: string }> = {
  anthropic: { baseUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-20250514' },
  openai: { baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/', model: 'gemini-2.0-flash' },
};
