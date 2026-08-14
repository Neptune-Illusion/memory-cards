import { TFile, type Vault } from 'obsidian';
import { parseNote } from './parser';
import type { Card, MemoryCardsSettings } from './types';

/** Reads the configured folder (recursively) and keeps an in-memory card index. */
export class CardIndex {
  private byId = new Map<string, Card>();
  private byPath = new Map<string, Card[]>();

  constructor(
    private readonly vault: Vault,
    private getSettings: () => MemoryCardsSettings
  ) {}

  get cards(): Card[] {
    return [...this.byId.values()];
  }

  get(id: string): Card | undefined {
    return this.byId.get(id);
  }

  /** Cards matching the tag filter; empty filter means every card. */
  filteredCards(): Card[] {
    const filter = this.getSettings().tagFilter;
    if (filter.length === 0) return this.cards;
    const wanted = new Set(filter.map((tag) => tag.replace(/^#/, '')));
    return this.cards.filter((card) => card.tags.some((tag) => wanted.has(tag)));
  }

  private inScope(path: string): boolean {
    const folder = this.getSettings().cardFolder.replace(/^\/+|\/+$/g, '');
    if (folder.length === 0) return path.endsWith('.md');
    return path === `${folder}.md` || path.startsWith(`${folder}/`);
  }

  async rebuild(): Promise<{ processed: number; skipped: number; duration: number }> {
    const startTime = performance.now();
    const allFiles = this.vault.getMarkdownFiles().filter((file) => this.inScope(file.path));

    // Track old paths to remove files that no longer exist
    const oldPaths = new Set(this.byPath.keys());
    const newPaths = new Set(allFiles.map((f) => f.path));

    // Incremental: remove files that are no longer in scope
    let removed = 0;
    for (const path of oldPaths) {
      if (!newPaths.has(path)) {
        this.removePath(path);
        removed++;
      }
    }

    let processed = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
      const batch = allFiles.slice(i, Math.min(i + BATCH_SIZE, allFiles.length));

      for (const file of batch) {
        await this.indexFile(file);
        processed++;
      }

      const batchNum = Math.ceil((i + batch.length) / BATCH_SIZE);
      const totalBatches = Math.ceil(allFiles.length / BATCH_SIZE);
      console.log(`[CardIndex] Batch ${batchNum}/${totalBatches} (${Math.min(i + BATCH_SIZE, allFiles.length)}/${allFiles.length} files)`);

      // Yield to main thread between batches
      if (i + BATCH_SIZE < allFiles.length) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const duration = performance.now() - startTime;
    const totalFiles = allFiles.length;
    console.log(
      `[CardIndex] Rebuild complete: ${totalFiles} files, ` +
      `${processed} processed, ${removed} removed in ${Math.round(duration)}ms`
    );

    return { processed, skipped: removed, duration };
  }

  async indexFile(file: TFile): Promise<void> {
    if (!this.inScope(file.path)) {
      this.removePath(file.path);
      return;
    }
    const settings = this.getSettings();
    const content = await this.vault.cachedRead(file);
    const cards = parseNote(file.path, content, {
      questionSeparator: settings.questionSeparator,
      noteSeparator: settings.noteSeparator,
    });
    this.removePath(file.path);
    if (cards.length === 0) return;
    this.byPath.set(file.path, cards);
    for (const card of cards) {
      this.byId.set(card.id, card);
    }
  }

  removePath(path: string): void {
    const existing = this.byPath.get(path);
    if (!existing) return;
    for (const card of existing) {
      this.byId.delete(card.id);
    }
    this.byPath.delete(path);
  }

  ids(): Set<string> {
    return new Set(this.byId.keys());
  }
}
