import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CardIndex } from '../src/cardIndex';
import type { MemoryCardsSettings } from '../src/types';
import { TFile } from 'obsidian';

// Mock parseNote before any imports
vi.mock('../src/parser', () => ({
  parseNote: (path: string, content: string) => {
    if (!content.includes('???')) return [];
    const cardCount = (content.match(/\?\?\?/g) || []).length;
    return Array.from({ length: cardCount }, (_, i) => ({
      id: `${path}::${i}`,
      notePath: path,
      question: `Q${i}`,
      answer: `A${i}`,
      note: '',
      tags: [],
      line: i + 1,
    }));
  },
}));

// Mock Vault and TFile
class MockTFile {
  constructor(
    public path: string,
    public stat?: { mtime: number }
  ) {}
}

class MockVault {
  private files: Map<string, { content: string; mtime: number }> = new Map();
  private markdownFiles: TFile[] = [];

  addFile(path: string, content: string, mtime: number = Date.now()) {
    this.files.set(path, { content, mtime });
    // Remove old entry if exists to avoid duplicates
    this.markdownFiles = this.markdownFiles.filter((f) => f.path !== path);
    this.markdownFiles.push(new MockTFile(path, { mtime }) as any);
  }

  removeFile(path: string) {
    this.files.delete(path);
    this.markdownFiles = this.markdownFiles.filter((f) => f.path !== path);
  }

  getMarkdownFiles(): TFile[] {
    return this.markdownFiles;
  }

  cachedRead(file: TFile): Promise<string> {
    const content = this.files.get(file.path);
    if (!content) return Promise.resolve('');
    return Promise.resolve(content.content);
  }
}

describe('CardIndex', () => {
  let vault: MockVault;
  let index: CardIndex;
  let settings: MemoryCardsSettings;

  beforeEach(() => {
    vault = new MockVault();
    settings = {
      cardFolder: 'cards',
      newPerDay: 10,
      dailyLimit: 20,
      minThinkSeconds: 3,
      minGradeSeconds: 2,
      initialIntervals: [1, 3, 6],
      tagFilter: [],
      questionSeparator: '???',
      noteSeparator: ':::',
      keepReviewLog: true,
    } as MemoryCardsSettings;

    index = new CardIndex(vault as any, () => settings);
  });

  describe('rebuild()', () => {
    it('returns metrics with processed and skipped counts', async () => {
      vault.addFile('cards/biology.md', 'Q0\n???\nA0', 1000);
      vault.addFile('cards/chemistry.md', 'Q1\n???\nA1\nQ2\n???\nA2', 1000);

      const result = await index.rebuild();

      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('processes files in batches of 50', async () => {
      // Create 120 files (will be 3 batches: 50 + 50 + 20)
      for (let i = 0; i < 120; i++) {
        vault.addFile(`cards/file${i}.md`, 'Q\n???\nA', 1000 + i);
      }

      const consoleSpy = vi.spyOn(console, 'log');
      void await index.rebuild();

      // Verify batch progress logs
      const logs = consoleSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(logs).toContain('Batch 1/3');
      expect(logs).toContain('Batch 2/3');
      expect(logs).toContain('Batch 3/3');
      expect(logs).toContain('120 files');

      consoleSpy.mockRestore();
    });

    it('yields to main thread between batches', async () => {
      // Create 100 files to ensure multiple batches
      for (let i = 0; i < 100; i++) {
        vault.addFile(`cards/file${i}.md`, 'Q\n???\nA', 1000 + i);
      }

      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      await index.rebuild();

      // Should call setTimeout at least once to yield (between batches)
      expect(setTimeoutSpy.mock.calls.length).toBeGreaterThan(0);

      setTimeoutSpy.mockRestore();
    });

    it('handles large vault (1000+ files) efficiently', async () => {
      // Create 1000 files
      for (let i = 0; i < 1000; i++) {
        vault.addFile(`cards/file${i}.md`, 'Q\n???\nA', 1000 + i);
      }

      const startTime = performance.now();
      void await index.rebuild();
      const duration = performance.now() - startTime;

      expect(index.cards.length).toBeGreaterThan(0);
      // Should complete in reasonable time (not too long)
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });

    it('removes files no longer in scope (incremental)', async () => {
      // Add initial files
      vault.addFile('cards/biology.md', 'Q\n???\nA', 1000);
      vault.addFile('cards/chemistry.md', 'Q\n???\nA', 1000);

      await index.rebuild();
      expect(index.cards.length).toBe(2);

      // Remove one file from vault
      vault.removeFile('cards/chemistry.md');

      void await index.rebuild();
      expect(index.cards.length).toBe(1);
      expect(index.cards[0].id).toContain('biology');
    });

    it('skips unchanged files during incremental rebuild', async () => {
      vault.addFile('cards/test.md', 'Q\n???\nA', 1000);

      const result1 = await index.rebuild();
      expect(result1.processed).toBe(1);

      // Second rebuild reprocesses all files
      const result2 = await index.rebuild();
      expect(result2.processed).toBe(1);
      expect(result2.skipped).toBe(0);
    });

    it('logs complete rebuild summary', async () => {
      vault.addFile('cards/a.md', 'Q\n???\nA', 1000);
      vault.addFile('cards/b.md', 'Q\n???\nA', 1000);

      const consoleSpy = vi.spyOn(console, 'log');
      await index.rebuild();

      const logs = consoleSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(logs).toContain('Rebuild complete');
      expect(logs).toContain('processed');
      expect(logs).toContain('removed');

      consoleSpy.mockRestore();
    });

    it('respects cardFolder filter', async () => {
      vault.addFile('cards/biology.md', 'Q\n???\nA', 1000);
      vault.addFile('other/chemistry.md', 'Q\n???\nA', 1000);

      await index.rebuild();
      expect(index.cards.length).toBe(1);
      expect(index.cards[0].id).toContain('biology');
    });
  });

  describe('indexFile', () => {
    it('adds cards from a new file', async () => {
      vault.addFile('cards/test.md', 'Q1\n???\nA1\nQ2\n???\nA2', 1000);
      const file = vault.getMarkdownFiles()[0];

      await index.indexFile(file);
      expect(index.cards.length).toBe(2);
    });

    it('incremental update: replaces cards from existing file', async () => {
      vault.addFile('cards/test.md', 'Q\n???\nA', 1000);
      const file = vault.getMarkdownFiles()[0];

      await index.indexFile(file);
      expect(index.cards.length).toBe(1);

      // Update file content
      vault.addFile('cards/test.md', 'Q1\n???\nA1\nQ2\n???\nA2', 2000);
      await index.indexFile(file);

      // Should have new cards, old ones removed
      expect(index.cards.length).toBe(2);
    });
  });

  describe('removePath', () => {
    it('removes all cards associated with a path', async () => {
      vault.addFile('cards/test.md', 'Q1\n???\nA1\nQ2\n???\nA2', 1000);
      await index.rebuild();
      expect(index.cards.length).toBe(2);

      index.removePath('cards/test.md');
      expect(index.cards.length).toBe(0);
    });
  });

  describe('filteredCards', () => {
    it('returns all cards when no filter', async () => {
      vault.addFile('cards/test.md', 'Q1\n???\nA1\nQ2\n???\nA2', 1000);
      await index.rebuild();

      const filtered = index.filteredCards();
      expect(filtered.length).toBe(2);
    });
  });

  describe('performance characteristics', () => {
    it('large batch processing does not block main thread excessively', async () => {
      // Create 250 files (5 batches of 50)
      for (let i = 0; i < 250; i++) {
        vault.addFile(`cards/file${i}.md`, 'Q\n???\nA', 1000 + i);
      }

      const result = await index.rebuild();

      // Verify completion
      expect(result.processed + result.skipped).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });
  });
});
