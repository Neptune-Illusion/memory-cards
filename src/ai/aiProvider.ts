/** AI provider abstraction — Phase 1 MVP. */

export interface AIProviderConfig {
  provider: 'claude';
  apiKey: string;
  model: string;
  endpoint?: string;
  temperature?: number;
  maxTokens?: number;
  /** Request timeout in ms (default 60s). */
  timeoutMs?: number;
  /** Max retries on transient failure (default 2). */
  maxRetries?: number;
}

export interface AIProvider {
  /** Check if config is valid and the API is reachable. */
  validate(): Promise<boolean>;
  /** Generate text from a prompt. Throws on failure. */
  generate(prompt: string, opts?: { signal?: AbortSignal }): Promise<string>;
}

export type CardCountTarget = number;
