import { Modal, MarkdownRenderer, type App, type Component } from 'obsidian';
import type { GeneratedCard } from '../cardGeneration/cardDeduplicator';

/**
 * Mobile-first card preview modal: browse, edit, select/deselect generated cards.
 * Returns the approved cards array when user confirms import.
 */
export class CardPreviewModal extends Modal {
  private cards: GeneratedCard[];
  private edits: Map<number, GeneratedCard> = new Map();
  private selected = new Set<number>();
  private currentIndex = 0;
  private resolveFn: (cards: GeneratedCard[]) => void = () => {};
  private owner: Component;

  constructor(app: App, cards: GeneratedCard[], owner: Component) {
    super(app);
    this.cards = cards;
    this.owner = owner;
    cards.forEach((_, i) => this.selected.add(i));
  }

  open(): Promise<GeneratedCard[]> {
    return new Promise<GeneratedCard[]>((resolve) => {
      this.resolveFn = resolve;
      super.open();
    });
  }

  onOpen(): void {
    this.modalEl.addClass('memory-cards-modal mc-card-preview-modal');
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
    this.resolveFn([]);
  }

  private getCard(i: number): GeneratedCard {
    return this.edits.get(i) ?? this.cards[i];
  }

  private render(): void {
    this.contentEl.empty();
    if (this.cards.length === 0) {
      this.contentEl.createEl('p', { text: '没有生成的卡片。', cls: 'mc-hint' });
      return;
    }

    const card = this.getCard(this.currentIndex);

    // Header: checkbox + counter
    const header = this.contentEl.createDiv({ cls: 'mc-preview-header' });
    const checkbox = header.createEl('input', { attr: { type: 'checkbox' } });
    checkbox.checked = this.selected.has(this.currentIndex);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) this.selected.add(this.currentIndex);
      else this.selected.delete(this.currentIndex);
      this.updateImportBtn();
    });
    header.createSpan({
      text: `${this.currentIndex + 1} / ${this.cards.length}`,
      cls: 'mc-preview-number',
    });

    // Question (read-only)
    const qEl = this.contentEl.createDiv({ cls: 'mc-preview-question' });
    qEl.createEl('strong', { text: '问题：' });
    void MarkdownRenderer.render(this.app, card.question, qEl, '', this.owner);

    // Answer (editable)
    this.contentEl.createEl('label', { text: '答案', cls: 'mc-field-label' });
    const answerEl = this.contentEl.createEl('textarea', {
      cls: 'mc-preview-answer',
      attr: { rows: '3' },
    });
    answerEl.value = card.answer;
    answerEl.addEventListener('input', () => {
      this.edits.set(this.currentIndex, { ...this.getCard(this.currentIndex), answer: answerEl.value });
    });

    // Note (editable, optional)
    this.contentEl.createEl('label', { text: '注解（可选）', cls: 'mc-field-label' });
    const noteEl = this.contentEl.createEl('textarea', {
      cls: 'mc-preview-note',
      attr: { rows: '2', placeholder: '记忆技巧 / 补充说明' },
    });
    noteEl.value = card.note ?? '';
    noteEl.addEventListener('input', () => {
      this.edits.set(this.currentIndex, { ...this.getCard(this.currentIndex), note: noteEl.value });
    });

    // Actions
    const actions = this.contentEl.createDiv({ cls: 'mc-actions' });
    const btnPrev = actions.createEl('button', { text: '◀ 上一张', cls: 'mc-btn-secondary' });
    btnPrev.addEventListener('click', () => {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.render();
      }
    });

    const btnNext = actions.createEl('button', { text: '下一张 ▶', cls: 'mc-btn-secondary' });
    btnNext.addEventListener('click', () => {
      if (this.currentIndex < this.cards.length - 1) {
        this.currentIndex++;
        this.render();
      }
    });

    const btnImport = actions.createEl('button', {
      text: `导入 (${this.selected.size}/${this.cards.length})`,
      cls: 'mod-cta',
    });
    this.importBtn = btnImport;
    btnImport.addEventListener('click', () => {
      const approved = [...this.selected].map((i) => this.getCard(i));
      this.close();
      this.resolveFn(approved);
    });

    const btnAll = actions.createEl('button', { text: '全选/反选' });
    btnAll.addEventListener('click', () => {
      if (this.selected.size === this.cards.length) {
        this.selected.clear();
      } else {
        this.cards.forEach((_, i) => this.selected.add(i));
      }
      this.render();
    });
  }

  private importBtn: HTMLButtonElement | null = null;
  private updateImportBtn(): void {
    if (this.importBtn) {
      this.importBtn.textContent = `导入 (${this.selected.size}/${this.cards.length})`;
    }
  }
}
