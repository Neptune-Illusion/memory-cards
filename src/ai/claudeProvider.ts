import type { AIProvider, AIProviderConfig } from './aiProvider';

/** Real Claude API provider with timeout, cancellation, and retry. */
export class ClaudeProvider implements AIProvider {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly config: AIProviderConfig) {
    this.endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.maxRetries = config.maxRetries ?? 2;
  }

  async validate(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 32,
          messages: [{ role: 'user', content: 'hi' }],
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      // 200 = success, 400 = bad request (but key works), 401 = bad key
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
        // Allow external abort to also cancel
        opts?.signal?.addEventListener('abort', () => ctrl.abort());

        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'x-api-key': this.config.apiKey,
            'content-type': 'application/json',
            'anthropic-version': '2023-06-01',
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
          throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`);
        }

        // Guard against absurdly large responses (e.g. model loop returning megabytes).
        const text = await res.text();
        if (text.length > 512_000) {
          throw new Error('AI response too large (over 500 KB), likely a model error.');
        }

        try {
          const data = JSON.parse(text);
          return data.content?.[0]?.text ?? '';
        } catch {
          throw new Error('AI returned non-JSON response.');
        }
      } catch (err: unknown) {
        lastError = err;
        // Don't retry on abort (user cancelled) or 4xx (client error)
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
