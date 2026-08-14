import type { AIProvider, AIProviderConfig } from './aiProvider';

/** OpenAI-compatible provider (covers OpenAI, DeepSeek, OpenRouter, local). */
export class OpenAIProvider implements AIProvider {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly config: AIProviderConfig) {
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.maxRetries = config.maxRetries ?? 2;
  }

  private get endpoint(): string {
    return this.config.baseUrl || 'https://api.openai.com/v1/chat/completions';
  }

  async validate(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 32,
          messages: [{ role: 'user', content: 'hi' }],
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      return res.status !== 401;
    } catch {
      return false;
    }
  }

  async generate(prompt: string, opts?: { signal?: AbortSignal }): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
        opts?.signal?.addEventListener('abort', () => ctrl.abort());

        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: this.config.maxTokens ?? 4096,
            temperature: this.config.temperature ?? 0.3,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`OpenAI API ${res.status}: ${body.slice(0, 200)}`);
        }

        const text = await res.text();
        if (text.length > 512_000) {
          throw new Error('AI response too large (over 500 KB).');
        }

        try {
          const data = JSON.parse(text);
          return data.choices?.[0]?.message?.content ?? '';
        } catch {
          throw new Error('AI returned non-JSON response.');
        }
      } catch (err: unknown) {
        lastError = err;
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error('AI request was cancelled.');
        }
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
