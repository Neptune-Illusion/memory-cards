import { Modal, Notice, normalizePath, Platform, TFile, type App } from 'obsidian';
import { renderCardMarkdown } from '../parser';
import type { MemoryCardsSettings } from '../types';
import type { Store } from '../store';

/** Quick Add (SPEC §1.2): write a new card into the card folder and index it immediately. */
export class QuickAddModal extends Modal {
  private question = '';
  private answer = '';
  private extraNote = '';
  private tags = '';
  private listeners: Map<EventTarget, Array<{ event: string; handler: EventListener }>> = new Map();

  constructor(
    app: App,
    private readonly settings: MemoryCardsSettings,
    private readonly onCreated: (file: TFile) => Promise<void>,
    private readonly store?: Store
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass('memory-cards-modal');
    // QuickAdd-specific class so desktop padding is scoped without touching review/summary modals
    this.modalEl.addClass('memory-cards-modal--quickadd');
    if (Platform.isMobile) {
      this.modalEl.addClass('memory-cards-modal--mobile');
    }
    this.contentEl.createEl('h2', { text: '新建记忆卡' });

    const question = this.field('问题', '要回忆出什么？');
    question.setAttribute('autocomplete', 'off');
    const questionInputHandler = () => {
      this.question = question.value;
      this.saveActiveSession();
    };
    const questionFocusHandler = () => this.scrollFieldIntoView(question);
    question.addEventListener('input', questionInputHandler);
    question.addEventListener('focus', questionFocusHandler);
    this.trackListener(question, 'input', questionInputHandler);
    this.trackListener(question, 'focus', questionFocusHandler);

    const answer = this.field('答案', '正确答案');
    answer.setAttribute('autocomplete', 'off');
    const answerInputHandler = () => {
      this.answer = answer.value;
      this.saveActiveSession();
    };
    const answerFocusHandler = () => this.scrollFieldIntoView(answer);
    answer.addEventListener('input', answerInputHandler);
    answer.addEventListener('focus', answerFocusHandler);
    this.trackListener(answer, 'input', answerInputHandler);
    this.trackListener(answer, 'focus', answerFocusHandler);

    const extra = this.field('注解（可选）', '怎么记 / 为什么会错');
    extra.setAttribute('autocomplete', 'off');
    const extraInputHandler = () => {
      this.extraNote = extra.value;
      this.saveActiveSession();
    };
    const extraFocusHandler = () => this.scrollFieldIntoView(extra);
    extra.addEventListener('input', extraInputHandler);
    extra.addEventListener('focus', extraFocusHandler);
    this.trackListener(extra, 'input', extraInputHandler);
    this.trackListener(extra, 'focus', extraFocusHandler);

    const tags = this.field('标签（可选，逗号分隔）', '生物, 期末', 'input');
    tags.setAttribute('autocomplete', 'off');
    tags.setAttribute('inputmode', 'text');
    const tagsInputHandler = () => {
      this.tags = tags.value;
      this.saveActiveSession();
    };
    const tagsFocusHandler = () => this.scrollFieldIntoView(tags);
    tags.addEventListener('input', tagsInputHandler);
    tags.addEventListener('focus', tagsFocusHandler);
    this.trackListener(tags, 'input', tagsInputHandler);
    this.trackListener(tags, 'focus', tagsFocusHandler);

    const actions = this.contentEl.createDiv({ cls: 'mc-actions' });
    const submit = actions.createEl('button', { text: '✓ 创建', cls: 'mod-cta' });
    submit.setAttribute('aria-label', '创建卡片（Cmd+Enter）');
    const submitClickHandler = () => void this.submit();
    submit.addEventListener('click', submitClickHandler);
    this.trackListener(submit, 'click', submitClickHandler);

    const cancel = actions.createEl('button', { text: '✕ 取消' });
    cancel.setAttribute('aria-label', '取消');
    const cancelClickHandler = () => this.close();
    cancel.addEventListener('click', cancelClickHandler);
    this.trackListener(cancel, 'click', cancelClickHandler);

    this.scope.register(['Mod'], 'Enter', (event) => {
      event.preventDefault();
      void this.submit();
    });

    // Setup viewport resize listener for mobile keyboard
    if (Platform.isMobile && window.visualViewport) {
      const resizeListener = () => this.adjustTextareaHeights();
      window.visualViewport.addEventListener('resize', resizeListener);
      this.trackListener(window.visualViewport, 'resize', resizeListener);
    }

    if (!Platform.isMobile) question.focus();
  }

  onClose(): void {
    // Clean up all event listeners
    this.removeAllListeners();
    this.contentEl.empty();
  }

  private saveActiveSession(): void {
    // Debounce activeSession save on any input change to preserve draft state
    if (!this.store) return;
    // Clear any existing timeout
    if ((this as any)._saveTimer) clearTimeout((this as any)._saveTimer);
    // Schedule save
    (this as any)._saveTimer = setTimeout(() => {
      const draftSession = {
        question: this.question,
        answer: this.answer,
        extraNote: this.extraNote,
        tags: this.tags,
      };
      // For now, we store draft state as a serialized object
      // This could be extended to preserve incomplete quick-add forms
      (this as any)._draftState = draftSession;
    }, 300);
  }

  private scrollFieldIntoView(field: HTMLInputElement | HTMLTextAreaElement): void {
    if (Platform.isMobile) {
      setTimeout(() => {
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }

  private adjustTextareaHeights(): void {
    const textareas = this.contentEl.querySelectorAll('textarea');
    textareas.forEach((ta) => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, window.visualViewport?.height! * 0.4) + 'px';
    });
  }

  private field(
    label: string,
    placeholder: string,
    kind: 'input' | 'textarea' = 'textarea'
  ): HTMLInputElement | HTMLTextAreaElement {
    const wrapper = this.contentEl.createDiv({ cls: 'mc-field' });
    wrapper.createEl('label', { text: label });
    const el =
      kind === 'input'
        ? wrapper.createEl('input', { type: 'text', placeholder })
        : wrapper.createEl('textarea', { placeholder });
    return el;
  }

  private async submit(): Promise<void> {
    if (this.question.trim().length === 0 || this.answer.trim().length === 0) {
      new Notice('问题和答案都不能为空。');
      return;
    }

    const folder = this.settings.cardFolder.replace(/^\/+|\/+$/g, '');
    if (folder.length > 0 && !this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }

    const body = renderCardMarkdown(
      this.question,
      this.answer,
      {
        questionSeparator: this.settings.questionSeparator,
        noteSeparator: this.settings.noteSeparator,
      },
      this.extraNote
    );

    const tagList = this.tags
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter((tag) => tag.length > 0);
    const frontmatter = ['---', 'memtype: card', `tags: [${tagList.join(', ')}]`, '---', ''].join('\n');

    const path = await this.uniquePath(folder, this.question);
    const file = await this.app.vault.create(path, frontmatter + body);
    await this.onCreated(file);
    new Notice(`已创建：${file.basename}`);
    this.close();
  }

  /** Derive a readable filename from the question, avoiding collisions. */
  private async uniquePath(folder: string, question: string): Promise<string> {
    const base =
      question
        .replace(/[\\/:*?"<>|#^[\]]/g, '')
        .trim()
        .slice(0, 40) || '记忆卡';
    for (let attempt = 0; ; attempt += 1) {
      const name = attempt === 0 ? base : `${base}-${attempt}`;
      const path = normalizePath(folder.length > 0 ? `${folder}/${name}.md` : `${name}.md`);
      if (!this.app.vault.getAbstractFileByPath(path)) return path;
    }
  }

  private trackListener(target: EventTarget, event: string, handler: EventListener): void {
    if (!this.listeners.has(target)) {
      this.listeners.set(target, []);
    }
    this.listeners.get(target)!.push({ event, handler });
  }

  private removeAllListeners(): void {
    Array.from(this.listeners.entries()).forEach(([target, handlers]) => {
      handlers.forEach(({ event, handler }) => {
        target.removeEventListener(event, handler);
      });
    });
    this.listeners.clear();
  }
}
