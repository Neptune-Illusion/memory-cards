import { describe, expect, it, vi } from 'vitest';
import { buildCardGenerationPrompt, parseGeneratedCards } from '../src/cardGeneration/cardGenerator';
import { deduplicateCards } from '../src/cardGeneration/cardDeduplicator';
import { ClaudeProvider } from '../src/ai/claudeProvider';
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

describe('buildCardGenerationPrompt', () => {
  it('includes newPerDay from settings', () => {
    const prompt = buildCardGenerationPrompt('test text', SETTINGS);
    expect(prompt).toContain('10');
    expect(prompt).toContain('test text');
  });

  it('truncates long text', () => {
    const long = 'x'.repeat(5000);
    const prompt = buildCardGenerationPrompt(long, SETTINGS);
    expect(prompt).toContain('文本已截断');
    expect(prompt.length).toBeLessThan(long.length + 200);
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

describe('ClaudeProvider', () => {
  it('validate returns false when no apiKey', async () => {
    const p = new ClaudeProvider({ provider: 'claude', apiKey: '', model: 'test' });
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
      const p = new ClaudeProvider({ provider: 'claude', apiKey: 'sk-test', model: 'test-model' });
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
      const p = new ClaudeProvider({ provider: 'claude', apiKey: 'sk-test', model: 'm', maxRetries: 2 });
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
      const p = new ClaudeProvider({ provider: 'claude', apiKey: 'sk-test', model: 'm' });
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
      const p = new ClaudeProvider({ provider: 'claude', apiKey: 'sk-test', model: 'm' });
      await expect(p.generate('hello')).rejects.toThrow('non-JSON');
    } finally {
      vi.restoreAllMocks();
    }
  });
});
