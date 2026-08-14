import { describe, expect, it, vi } from 'vitest';
import { buildChunkPrompt, parseGeneratedCards, splitIntoChunks } from '../src/cardGeneration/cardGenerator';
import { deduplicateCards, applyMaxCards } from '../src/cardGeneration/cardDeduplicator';
import { AnthropicProvider } from '../src/ai/anthropicProvider';
import { OpenAIProvider } from '../src/ai/openaiProvider';
import { GeminiProvider } from '../src/ai/geminiProvider';
import { createProvider } from '../src/ai/providerFactory';
import type { Card } from '../src/types';
import type { MemoryCardsSettings } from '../src/types';

const SETTINGS: MemoryCardsSettings = {
  cardFolder: '卡片',
  newPerDay: 10,
  dailyLimit: 20,
  minThinkSeconds: 3,
  minGradeSeconds: 2,
  initialIntervals: [1, 3, 6],
  tagFilter: [],
  questionSeparator: '???',
  noteSeparator: ':::',
  keepReviewLog: true,
};

describe('buildChunkPrompt', () => {
  it('includes newPerDay from settings', () => {
    const prompt = buildChunkPrompt('test text', 0, 1, SETTINGS, 5);
    expect(prompt).toContain('5');
    expect(prompt).toContain('test text');
  });

  it('splitIntoChunks splits long text into overlapping chunks', () => {
    const long = 'x'.repeat(8000);
    const chunks = splitIntoChunks(long, 3000, 500);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThanOrEqual(3000);
    // Overlap check: second chunk starts before first ends
    const secondStart = long.indexOf(chunks[1]);
    expect(secondStart).toBeLessThan(3000);
  });
});

describe('parseGeneratedCards', () => {
  it('parses valid JSON response', () => {
    const response = `Here are the cards:
\`\`\`json
{
  "cards": [
    { "question": "Q1?", "answer": "A1", "note": "N1" },
    { "question": "Q2?", "answer": "A2" }
  ]
}
\`\`\``;
    const cards = parseGeneratedCards(response);
    expect(cards).toHaveLength(2);
    expect(cards[0].question).toBe('Q1?');
    expect(cards[0].note).toBe('N1');
    expect(cards[1].note).toBeUndefined();
  });

  it('returns empty array for unparseable response', () => {
    expect(parseGeneratedCards('no json here')).toEqual([]);
  });

  it('filters out cards with empty question or answer', () => {
    const response = '{"cards": [{"question": "", "answer": "a"}, {"question": "q", "answer": ""}]}';
    expect(parseGeneratedCards(response)).toEqual([]);
  });

  it('handles response with extra text around JSON', () => {
    const response = 'Sure! Here are the cards:\n{"cards":[{"question":"Q?","answer":"A"}]}\nDone.';
    const cards = parseGeneratedCards(response);
    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Q?');
  });
});

describe('deduplicateCards', () => {
  const existing: Card[] = [
    { id: 'n::0', notePath: 'n.md', question: '细胞呼吸分几种？', answer: '两种', tags: [], line: 1 },
  ];

  it('removes cards similar to existing', () => {
    const generated = [
      { question: '细胞呼吸分几种类型？', answer: '有氧和无氧' },
      { question: '线粒体在哪？', answer: '细胞内' },
    ];
    const result = deduplicateCards(generated, existing);
    expect(result.length).toBeLessThan(generated.length);
  });

  it('removes duplicates within generated set', () => {
    const generated = [
      { question: 'ATP是什么？', answer: '能量分子' },
      { question: 'ATP是什么？', answer: '能量分子' },
    ];
    const result = deduplicateCards(generated, []);
    expect(result).toHaveLength(1);
  });

  it('keeps all when no overlap', () => {
    const generated = [
      { question: 'Photosynthesis?', answer: 'Light energy' },
      { question: 'Mitochondria?', answer: 'Powerhouse' },
    ];
    const result = deduplicateCards(generated, existing);
    expect(result).toHaveLength(2);
  });
});

describe('AnthropicProvider', () => {
  it('validate returns false when no apiKey', async () => {
    const p = new AnthropicProvider({ provider: 'anthropic', apiKey: '', model: 'test' });
    expect(await p.validate()).toBe(false);
  });

  it('generate calls fetch with correct headers', async () => {
    const apiResponse = JSON.stringify({ content: [{ text: '{"cards":[]}' }] });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => apiResponse,
    });
    vi.stubGlobal('fetch', mockFetch);
    try {
      const p = new AnthropicProvider({ provider: 'anthropic', apiKey: 'sk-test', model: 'test-model' });
      const result = await p.generate('hello');
      expect(result).toBe('{"cards":[]}');
      expect(mockFetch).toHaveBeenCalled();
      const call = mockFetch.mock.calls[0];
      expect(call[1].headers['x-api-key']).toBe('sk-test');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('generate retries on transient failure', async () => {
    let calls = 0;
    const apiResponse = JSON.stringify({ content: [{ text: 'ok' }] });
    const mockFetch = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error('network');
      return { ok: true, text: async () => apiResponse };
    });
    vi.stubGlobal('fetch', mockFetch);
    try {
      const p = new AnthropicProvider({ provider: 'anthropic', apiKey: 'sk-test', model: 'm', maxRetries: 2 });
      const result = await p.generate('hello');
      expect(result).toBe('ok');
      expect(calls).toBe(3);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('generate rejects response over 500 KB size limit', async () => {
    const huge = 'x'.repeat(600_000);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => huge,
    });
    vi.stubGlobal('fetch', mockFetch);
    try {
      const p = new AnthropicProvider({ provider: 'anthropic', apiKey: 'sk-test', model: 'm' });
      await expect(p.generate('hello')).rejects.toThrow('too large');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('generate rejects non-JSON response from API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'not-json-at-all',
    });
    vi.stubGlobal('fetch', mockFetch);
    try {
      const p = new AnthropicProvider({ provider: 'anthropic', apiKey: 'sk-test', model: 'm' });
      await expect(p.generate('hello')).rejects.toThrow('non-JSON');
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe('splitIntoChunks', () => {
  it('splits long text into multiple chunks', () => {
    const text = 'A'.repeat(10000);
    const chunks = splitIntoChunks(text, 3000, 500);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('keeps short text as single chunk', () => {
    expect(splitIntoChunks('short text')).toEqual(['short text']);
  });

  it('chunks overlap to avoid splitting mid-concept', () => {
    const text = 'A'.repeat(5500);
    const chunks = splitIntoChunks(text, 3000, 500);
    expect(chunks.length).toBe(2);
    // Second chunk should start 500 chars before end of first
    expect(chunks[0].length + chunks[1].length).toBeGreaterThan(5500);
  });
});

describe('deduplicateCards — cross-chunk dedup', () => {
  it('removes duplicate question+answer pairs across chunks', () => {
    const generated = [
      { question: 'ATP是什么？', answer: '能量分子', source: 'chunk_1/2' },
      { question: 'ATP是什么？', answer: '能量分子', source: 'chunk_2/2' },
      { question: '线粒体在哪？', answer: '细胞内', source: 'chunk_1/2' },
    ];
    const result = deduplicateCards(generated, []);
    expect(result).toHaveLength(2);
  });

  it('keeps same question with different answers', () => {
    const generated = [
      { question: 'ATP是什么？', answer: '腺苷三磷酸', source: 'chunk_1/2' },
      { question: 'ATP是什么？', answer: '细胞的能量货币', source: 'chunk_2/2' },
    ];
    const result = deduplicateCards(generated, []);
    expect(result).toHaveLength(2);
  });
});

describe('error degradation — partial chunk failure', () => {
  it('continues generation when one chunk fails', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error('Network error');
      return {
        ok: true,
        text: async () => JSON.stringify({
          content: [{ text: '{"cards":[{"question":"Q?","answer":"A"}]}' }],
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);
    try {
      const p = new AnthropicProvider({ provider: 'anthropic', apiKey: 'sk-test', model: 'test', maxRetries: 0 });
      // First call fails, second succeeds
      const r1 = await p.generate('chunk1').catch(() => null);
      const r2 = await p.generate('chunk2');
      expect(r1).toBeNull();
      expect(r2).toContain('cards');
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe('multi-chunk generation produces multiple cards', () => {
  it('two chunks each producing cards yields combined results', () => {
    const chunk1Cards = parseGeneratedCards('{"cards":[{"question":"Q1?","answer":"A1"},{"question":"Q2?","answer":"A2"}]}');
    const chunk2Cards = parseGeneratedCards('{"cards":[{"question":"Q3?","answer":"A3"},{"question":"Q4?","answer":"A4"}]}');
    const all = [...chunk1Cards, ...chunk2Cards];
    const deduped = deduplicateCards(all, []);
    expect(deduped.length).toBe(4);
  });

  it('overlapping chunks with same content are deduped', () => {
    const chunk1Cards = parseGeneratedCards('{"cards":[{"question":"ATP是什么？","answer":"能量分子"}]}');
    const chunk2Cards = parseGeneratedCards('{"cards":[{"question":"ATP是什么？","answer":"能量分子"}]}');
    const all = [...chunk1Cards, ...chunk2Cards];
    const deduped = deduplicateCards(all, []);
    expect(deduped).toHaveLength(1);
  });
});

describe('OpenAIProvider', () => {
  it('validate returns false when no apiKey', async () => {
    const p = new OpenAIProvider({ provider: 'openai', apiKey: '', model: 'test' });
    expect(await p.validate()).toBe(false);
  });

  it('generate sends Bearer token and parses response', async () => {
    const innerJson = '{"cards":[]}';
    const apiResponse = JSON.stringify({ choices: [{ message: { content: innerJson } }] });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => apiResponse });
    vi.stubGlobal('fetch', mockFetch);
    try {
      const p = new OpenAIProvider({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o' });
      const result = await p.generate('hello');
      expect(result).toBe('{"cards":[]}');
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer sk-test');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('generate rejects non-JSON response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => 'not-json' });
    vi.stubGlobal('fetch', mockFetch);
    try {
      const p = new OpenAIProvider({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o' });
      await expect(p.generate('hello')).rejects.toThrow('non-JSON');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('generate rejects response over 500 KB', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => 'x'.repeat(600_000) });
    vi.stubGlobal('fetch', mockFetch);
    try {
      const p = new OpenAIProvider({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o' });
      await expect(p.generate('hello')).rejects.toThrow('too large');
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe('GeminiProvider', () => {
  it('validate returns false when no apiKey', async () => {
    const p = new GeminiProvider({ provider: 'gemini', apiKey: '', model: 'test' });
    expect(await p.validate()).toBe(false);
  });

  it('generate sends key in URL and parses response', async () => {
    const apiResponse = JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"cards":[]}' }] } }] });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => apiResponse });
    vi.stubGlobal('fetch', mockFetch);
    try {
      const p = new GeminiProvider({ provider: 'gemini', apiKey: 'ai-test-key', model: 'gemini-2.0-flash' });
      const result = await p.generate('hello');
      expect(result).toBe('{"cards":[]}');
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('key=ai-test-key');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('generate error message does not leak API key', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Invalid key in request URL: https://api?key=super-secret-key-12345',
    });
    vi.stubGlobal('fetch', mockFetch);
    try {
      const p = new GeminiProvider({ provider: 'gemini', apiKey: 'super-secret-key-12345', model: 'm' });
      try {
        await p.generate('hello');
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.message).not.toContain('super-secret-key-12345');
        expect(err.message).toContain('key=***');
      }
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe('providerFactory migration — legacy "claude" provider', () => {
  it('maps provider "claude" to AnthropicProvider', () => {
    const p = createProvider({ provider: 'claude' as any, apiKey: 'sk-test', model: 'test' });
    expect(p).toBeInstanceOf(AnthropicProvider);
  });

  it('maps provider "anthropic" to AnthropicProvider', () => {
    const p = createProvider({ provider: 'anthropic', apiKey: 'sk-test', model: 'test' });
    expect(p).toBeInstanceOf(AnthropicProvider);
  });

  it('maps provider "openai" to OpenAIProvider', () => {
    const p = createProvider({ provider: 'openai', apiKey: 'sk-test', model: 'test' });
    expect(p).toBeInstanceOf(OpenAIProvider);
  });

  it('maps provider "gemini" to GeminiProvider', () => {
    const p = createProvider({ provider: 'gemini', apiKey: 'ai-test', model: 'test' });
    expect(p).toBeInstanceOf(GeminiProvider);
  });
});

describe('normalizeAIConfig — old config migration', () => {
  it('migrates provider claude → anthropic', async () => {
    const { normalizeAIConfig } = await import('../src/ui/aiConfigPanel');
    const old = { provider: 'claude' as any, apiKey: 'sk-test', model: 'claude-3', endpoint: 'https://proxy.example.com/v1/messages' };
    const result = normalizeAIConfig(old);
    expect(result.provider).toBe('anthropic');
  });

  it('migrates endpoint to baseUrl when baseUrl is empty', async () => {
    const { normalizeAIConfig } = await import('../src/ui/aiConfigPanel');
    const old = { provider: 'claude' as any, apiKey: 'sk-test', model: 'm', endpoint: 'https://proxy.example.com/api' };
    const result = normalizeAIConfig(old);
    expect(result.baseUrl).toBe('https://proxy.example.com/api');
  });

  it('preserves existing baseUrl when endpoint also present', async () => {
    const { normalizeAIConfig } = await import('../src/ui/aiConfigPanel');
    const old = { provider: 'anthropic' as any, apiKey: 'k', model: 'm', baseUrl: 'https://keep-this.com', endpoint: 'https://old.com' };
    const result = normalizeAIConfig(old);
    expect(result.baseUrl).toBe('https://keep-this.com');
  });

  it('clamps maxCards to 1-500', async () => {
    const { normalizeAIConfig } = await import('../src/ui/aiConfigPanel');
    expect(normalizeAIConfig({ maxCards: 0 }).maxCards).toBe(1);
    expect(normalizeAIConfig({ maxCards: 999 }).maxCards).toBe(500);
    expect(normalizeAIConfig({ maxCards: -5 }).maxCards).toBe(1);
  });

  it('fills missing density/maxCards with defaults', async () => {
    const { normalizeAIConfig, DEFAULT_AI_CONFIG } = await import('../src/ui/aiConfigPanel');
    const result = normalizeAIConfig({ provider: 'openai', apiKey: 'k', model: 'm' });
    expect(result.generationDensity).toBe(DEFAULT_AI_CONFIG.generationDensity);
    expect(result.maxCards).toBe(DEFAULT_AI_CONFIG.maxCards);
  });
});

describe('DENSITY_CARDS_PER_CHUNK', () => {
  it('low=2, standard=5, high=10', async () => {
    const { DENSITY_CARDS_PER_CHUNK } = await import('../src/ui/aiConfigPanel');
    expect(DENSITY_CARDS_PER_CHUNK.low).toBe(2);
    expect(DENSITY_CARDS_PER_CHUNK.standard).toBe(5);
    expect(DENSITY_CARDS_PER_CHUNK.high).toBe(10);
  });
});

describe('maxCards truncation', () => {
  it('truncates to maxCards after dedup using applyMaxCards', () => {
    const cards = Array.from({ length: 20 }, (_, i) => ({
      question: `Q${i}?`,
      answer: `A${i}`,
    }));
    const deduped = deduplicateCards(cards, []);
    const truncated = applyMaxCards(deduped, 5);
    expect(truncated).toHaveLength(5);
  });

  it('returns all cards when maxCards exceeds count', () => {
    const cards = [{ question: 'Q1?', answer: 'A1' }, { question: 'Q2?', answer: 'A2' }];
    const result = applyMaxCards(cards, 100);
    expect(result).toHaveLength(2);
  });

  it('returns empty when maxCards is 0', () => {
    const result = applyMaxCards([{ question: 'Q?', answer: 'A' }], 0);
    expect(result).toHaveLength(0);
  });
});
