import type { AIProvider, AIProviderConfig } from './aiProvider';

/** Google Gemini API provider. */
export class GeminiProvider implements AIProvider {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly config: AIProviderConfig) {
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.maxRetries = config.maxRetries ?? 2;
  }

  private get endpoint(): string {
    const base = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/';
    return `${base.replace(/\/$/, '')}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;
  }

  async validate(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const base = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/';
      const url = `${base.replace(/\/$/, '')}/models/${this.config.model}?key=${this.config.apiKey}`;
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      return res.ok;
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: this.config.maxTokens ?? 4096,
              temperature: this.config.temperature ?? 0.3,
            },
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          // Sanitize: Gemini errors may echo the request URL which contains ?key=...
          const sanitized = body.replace(/key=[^&\s]*/gi, 'key=***');
          throw new Error(`Gemini API ${res.status}: ${sanitized.slice(0, 200)}`);
        }

        const text = await res.text();
        if (text.length > 512_000) {
          throw new Error('AI response too large (over 500 KB).');
        }

        const data = JSON.parse(text);
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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
