import { Notice, Plugin, TFile } from 'obsidian';
import { CardIndex } from './cardIndex';
import { buildQueue } from './scheduler';
import { computeStats } from './stats';
import { Store } from './store';
import { SessionManager } from './session';
import { ConfirmDialog } from './ui/confirmDialog';
import { mapConfirmResult } from './ui/confirmResult';
import { QuickAddModal } from './ui/quickAddModal';
import { ReviewModal } from './ui/reviewModal';
import { MemoryCardsSettingTab } from './ui/settingsTab';
import { StatsModal } from './ui/statsModal';
import type { Card } from './types';
import { DEFAULT_AI_CONFIG, DENSITY_CARDS_PER_CHUNK } from './ui/aiConfigPanel';
import { PDFPickerModal } from './ui/pdfPickerModal';
import { CardPreviewModal } from './ui/cardPreviewModal';
import { PDFExtractor } from './pdf/pdfExtractor';
import { createProvider } from './ai/providerFactory';
import { splitIntoChunks, buildChunkPrompt, parseGeneratedCards } from './cardGeneration/cardGenerator';
import { deduplicateCards, applyMaxCards } from './cardGeneration/cardDeduplicator';
import { renderCardMarkdown } from './parser';

export default class MemoryCardsPlugin extends Plugin {
  store!: Store;
  index!: CardIndex;

  async onload(): Promise<void> {
    this.store = new Store({
      loadData: () => this.loadData(),
      saveData: (data) => this.saveData(data),
    });
    await this.store.load();
    this.store.normalizeAIConfig();

    this.index = new CardIndex(this.app.vault, () => this.store.settings);

    this.addSettingTab(new MemoryCardsSettingTab(this.app, this));

    this.addCommand({
      id: 'start-review',
      name: '开始复习',
      callback: () => this.startReview(),
    });
    this.addCommand({
      id: 'quick-add-card',
      name: '新建记忆卡',
      callback: () => this.quickAdd(),
    });
    this.addCommand({
      id: 'show-stats',
      name: '查看统计',
      callback: () => this.showStats(),
    });
    this.addCommand({
      id: 'rebuild-index',
      name: '重建卡片索引',
      callback: async () => {
        await this.refreshIndex();
        new Notice(`已索引 ${this.index.cards.length} 张卡片。`);
      },
    });
    this.addCommand({
      id: 'pdf-auto-cards',
      name: '从 PDF 生成卡片',
      callback: () => this.generateCardsFromPDF(),
    });

    this.addRibbonIcon('brain-circuit', '开始复习', () => this.startReview());
    this.addRibbonIcon('plus', '新建记忆卡', () => this.quickAdd());

    // Index after the vault is ready so getMarkdownFiles() sees everything.
    this.app.workspace.onLayoutReady(() => {
      void this.refreshIndex();
    });

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && file.extension === 'md') void this.index.indexFile(file);
      })
    );
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && file.extension === 'md') void this.index.indexFile(file);
      })
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile) this.index.removePath(file.path);
      })
    );
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        this.index.removePath(oldPath);
        if (file instanceof TFile && file.extension === 'md') void this.index.indexFile(file);
      })
    );
  }

  async onunload(): Promise<void> {
    await this.store.flush();
  }

  async refreshIndex(): Promise<void> {
    await this.index.rebuild();
  }

  private async startReview(): Promise<void> {
    const now = new Date();
    const cards = this.index.filteredCards();
    if (cards.length === 0) {
      new Notice(
        `在「${this.store.settings.cardFolder || 'vault 根目录'}」没有找到卡片。用「新建记忆卡」创建第一张。`
      );
      return;
    }

    // Check for interrupted session
    const activeSession = this.store.getActiveSession();
    if (activeSession) {
      const isExpired = SessionManager.isExpired(activeSession, now);
      const existingIds = new Set(cards.map((c) => c.id));
      const restored = SessionManager.restore(activeSession, existingIds);

      if (restored.valid && !isExpired && restored.queueIds.length > 0) {
        const resumeQueue = restored.queueIds
          .map((id) => this.index.get(id))
          .filter((card): card is Card => Boolean(card));

        if (resumeQueue.length > 0) {
          const decision = await this.promptResumeSession();
          if (decision === 'abandon') {
            // Explicit abandon: drop the old session and start a fresh review.
            this.store.setActiveSession(undefined);
          } else if (decision === 'dismiss') {
            // Dismissed (X / overlay / Escape): keep the old session so the
            // next startReview re-prompts; start nothing right now.
            return;
          } else {
            this.openReview(
              resumeQueue,
              restored.currentIndex,
              restored.queueIds,
              restored.revealed
            );
            return;
          }
        }
      }

      // Session expired or no valid cards - discard it
      this.store.setActiveSession(undefined);
    }

    // Build new queue
    const { order } = buildQueue(
      cards.map((card) => ({ id: card.id, state: this.store.getState(card.id) })),
      now,
      this.store.settings,
      this.store.newCardsIntroducedToday(now)
    );

    const queue = order
      .map((id) => this.index.get(id))
      .filter((card): card is Card => Boolean(card));

    if (queue.length === 0) {
      new Notice('今天没有到期卡片 — 休息一下，明天见。');
      return;
    }

    this.openReview(queue);
  }

  private openReview(
    queue: Card[],
    initialIndex = 0,
    queueIds?: string[],
    initialRevealed = false
  ): void {
    // Persist session before opening so background kill captures it
    const ids = queueIds || queue.map((c) => c.id);
    this.store.setActiveSession(
      SessionManager.serialize(ids, initialIndex, initialRevealed)
    );
    new ReviewModal(
      this.app,
      this.store,
      queue,
      initialIndex,
      ids,
      initialRevealed,
      () => this.quickAdd()
    ).open();
  }

  private promptResumeSession(): Promise<'continue' | 'abandon' | 'dismiss'> {
    return new ConfirmDialog(
      this.app,
      '继续上次的复习？',
      '选择"继续"从上次中断处恢复，或"放弃"开始新的复习。',
      '继续',
      '放弃'
    ).then(
      (r) => mapConfirmResult(r, 'continue', 'abandon', 'dismiss') as 'continue' | 'abandon' | 'dismiss'
    );
  }

  private quickAdd(): void {
    new QuickAddModal(this.app, this.store.settings, async (file) => {
      await this.index.indexFile(file);
    }, this.store).open();
  }

  private showStats(): void {
    const now = new Date();
    const cards = this.index.filteredCards();
    const stats = computeStats(
      cards.map((card) => card.id),
      this.store.states,
      this.store.reviewLog,
      this.store.reviewedDays,
      now,
      this.store.settings.minThinkSeconds
    );
    const antiCheatOn =
      this.store.settings.minThinkSeconds > 0 || this.store.settings.minGradeSeconds > 0;
    new StatsModal(this.app, stats, antiCheatOn).open();
  }

  getAIConfig() {
    return this.store.aiConfig;
  }

  async saveAIConfig(config: typeof DEFAULT_AI_CONFIG): Promise<void> {
    this.store.setAIConfig(config);
  }

  private async generateCardsFromPDF(): Promise<void> {
    const config = this.store.aiConfig;
    if (!config.apiKey) {
      new Notice('请先在设置 → AI 自动制卡 中配置 API Key。');
      return;
    }

    // Step 1: Pick PDF
    const file = await new PDFPickerModal(this.app).open();
    if (!file) return;

    // Step 2: Extract text
    new Notice('正在提取 PDF 文本...');
    const text = await PDFExtractor.extract(file, this.app);
    if (!text) {
      new Notice('无法从 PDF 提取文本。如果是扫描件，请使用外部 OCR 工具。');
      return;
    }

    // Step 3: Chunk text
    const chunks = splitIntoChunks(text);
    new Notice(`文本已分为 ${chunks.length} 个片段，开始生成卡片...`);

    // Step 4: Create provider
    const provider = createProvider({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    // Step 5: Generate cards per chunk with progress
    const allGenerated: import('./cardGeneration/cardDeduplicator').GeneratedCard[] = [];
    const errors: string[] = [];
    const cardsPerChunk = DENSITY_CARDS_PER_CHUNK[config.generationDensity] ?? 5;

    for (let i = 0; i < chunks.length; i++) {
      new Notice(`生成片段 ${i + 1}/${chunks.length}...`);
      try {
        const prompt = buildChunkPrompt(chunks[i], i, chunks.length, this.store.settings, cardsPerChunk);
        const response = await provider.generate(prompt);
        const cards = parseGeneratedCards(response);
        allGenerated.push(...cards);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`片段 ${i + 1}: ${msg}`);
        // Continue with other chunks — don't let one failure kill the whole batch
      }
    }

    if (allGenerated.length === 0) {
      const errMsg = errors.length > 0 ? `\n失败摘要：${errors.join('; ')}` : '';
      new Notice(`AI 未返回有效的卡片。${errMsg}`);
      return;
    }

    // Step 6: Cross-chunk deduplicate
    const deduped = deduplicateCards(allGenerated, this.index.filteredCards());

    // Step 7: Hard truncation to maxCards
    const truncated = applyMaxCards(deduped, config.maxCards);

    // Step 8: Preview + Edit + Import
    const approved = await new CardPreviewModal(this.app, truncated, this).open();
    if (approved.length === 0) return;

    // Step 8: Write cards to vault
    const folder = this.store.settings.cardFolder.replace(/^\/+|\/+$/g, '');
    if (folder.length > 0 && !this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }

    let created = 0;
    for (const card of approved) {
      const body = renderCardMarkdown(
        card.question,
        card.answer,
        {
          questionSeparator: this.store.settings.questionSeparator,
          noteSeparator: this.store.settings.noteSeparator,
        },
        card.note
      );
      const base = card.question
        .replace(/[\\/:*?"<>|#^[\]]/g, '')
        .trim()
        .slice(0, 40) || '记忆卡';
      let path = folder.length > 0 ? `${folder}/${base}.md` : `${base}.md`;
      let attempt = 0;
      while (this.app.vault.getAbstractFileByPath(path)) {
        attempt++;
        path = folder.length > 0 ? `${folder}/${base}-${attempt}.md` : `${base}-${attempt}.md`;
      }
      const f = await this.app.vault.create(path, body);
      await this.index.indexFile(f);
      created++;
    }

    let summary = `成功导入 ${created} 张卡片。`;
    if (errors.length > 0) {
      summary += `\n${errors.length} 个片段失败：${errors.join('; ')}`;
    }
    new Notice(summary);
  }
}