import { MarkdownRenderer, Modal, Notice, Platform, type App, type Component } from 'obsidian';
import { checkGradeDistribution, checkTiming, shouldNudgeBeforeReveal } from '../anticheat';
import { review } from '../scheduler';
import type { Store } from '../store';
import { SessionManager } from '../session';
import { GRADE, type Card, type Grade } from '../types';

interface GradeButton {
  label: string;
  hint: string;
  grade: Grade;
  key: string;
}

const GRADE_BUTTONS: GradeButton[] = [
  { label: '忘记', hint: '完全没想起', grade: GRADE.AGAIN, key: '1' },
  { label: '模糊', hint: '想起但困难', grade: GRADE.HARD, key: '2' },
  { label: '正确', hint: '正常想起', grade: GRADE.GOOD, key: '3' },
  { label: '轻松', hint: '毫不费力', grade: GRADE.EASY, key: '4' },
];

const ENCOURAGEMENTS = [
  '🔥 保持这个节奏',
  '💪 又攻下一组',
  '✨ 记忆在变牢',
  '🎯 稳定推进中',
];

/**
 * Review session (SPEC §3): question → active recall → reveal → grade.
 * Two clicks per card, fully keyboard driven (space + 1-4).
 */
export class ReviewModal extends Modal {
  private index = 0;
  private revealed = false;
  private shownAt = 0;
  private revealedAt = 0;
  private completed = 0;
  private nudged = false;
  private graded = new Map<string, Grade>();
  private touchStartX = 0;
  private touchStartY = 0;
  private queueIds: string[];
  private listeners: Map<EventTarget, Array<{ event: string; handler: EventListener }>> = new Map();

  constructor(
    app: App,
    private readonly store: Store,
    private readonly queue: Card[],
    private readonly owner: Component,
    initialIndex = 0,
    queueIds?: string[],
    initialRevealed = false
  ) {
    super(app);
    this.index = initialIndex;
    this.revealed = initialRevealed;
    this.queueIds = queueIds || queue.map((c) => c.id);
  }

  onOpen(): void {
    this.modalEl.addClass('memory-cards-modal');
    this.scope.register([], ' ', (event) => {
      event.preventDefault();
      if (!this.revealed) this.reveal();
    });
    for (const button of GRADE_BUTTONS) {
      this.scope.register([], button.key, (event) => {
        event.preventDefault();
        if (this.revealed) void this.grade(button.grade);
      });
    }
    // Arrow keys: left = harder, right = easier
    this.scope.register([], 'ArrowLeft', (event) => {
      event.preventDefault();
      if (this.revealed) void this.grade(GRADE.HARD);
    });
    this.scope.register([], 'ArrowRight', (event) => {
      event.preventDefault();
      if (this.revealed) void this.grade(GRADE.EASY);
    });
    this.setupGestureListeners();
    this.setupViewportListener();
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
    // Clean up all event listeners
    this.removeAllListeners();
    // Save session state if not completed
    if (this.index < this.queue.length) {
      const session = SessionManager.serialize(this.queueIds, this.index, this.revealed);
      this.store.setActiveSession(session);
    } else {
      // Session completed, clear saved session
      this.store.setActiveSession(undefined);
    }
  }

  private setupGestureListeners(): void {
    const touchStartHandler = ((e: TouchEvent) => {
      const touch = e.touches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
    }) as EventListener;
    const touchEndHandler = ((e: TouchEvent) => {
      if (!this.revealed) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;
      // Require horizontal swipe (50px threshold), not vertical scroll
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX < 0) {
          // Swipe left = harder (模糊)
          void this.grade(GRADE.HARD);
        } else {
          // Swipe right = easier (轻松)
          void this.grade(GRADE.EASY);
        }
      }
    }) as EventListener;
    this.modalEl.addEventListener('touchstart', touchStartHandler);
    this.modalEl.addEventListener('touchend', touchEndHandler);
    this.trackListener(this.modalEl, 'touchstart', touchStartHandler);
    this.trackListener(this.modalEl, 'touchend', touchEndHandler);
  }

  private setupViewportListener(): void {
    if (Platform.isMobile && window.visualViewport) {
      const resizeListener = () => this.adjustAnswerHeight();
      window.visualViewport.addEventListener('resize', resizeListener);
      this.trackListener(window.visualViewport, 'resize', resizeListener);
    }
  }

  private adjustAnswerHeight(): void {
    const answer = this.contentEl.querySelector('.mc-answer') as HTMLElement | null;
    if (!answer || !window.visualViewport) return;
    // Reserve space for virtual keyboard (~40% of viewport)
    const maxHeight = window.visualViewport.height * 0.6;
    answer.style.maxHeight = `${maxHeight}px`;
    answer.style.overflowY = 'auto';
  }

  private get current(): Card | undefined {
    return this.queue[this.index];
  }

  private render(): void {
    const card = this.current;
    this.contentEl.empty();
    if (!card) {
      this.renderSummary();
      return;
    }

    this.shownAt = Date.now();
    this.nudged = false;

    const header = this.contentEl.createDiv({ cls: 'mc-header' });
    header.createSpan({ text: `${this.index + 1} / ${this.queue.length}`, cls: 'mc-progress-text' });
    const bar = header.createDiv({ cls: 'mc-progress' });
    bar.createDiv({ cls: 'mc-progress-fill' }).style.width = `${(this.index / this.queue.length) * 100}%`;

    const question = this.contentEl.createDiv({ cls: 'mc-question' });
    void MarkdownRenderer.render(this.app, card.question, question, card.notePath, this.owner);

    const hintText = Platform.isMobile
      ? '💭 先在脑海里回答，然后点按钮揭晓。'
      : '💭 先在脑海里回答。按空格或点按钮揭晓。';
    this.contentEl.createDiv({
      cls: 'mc-hint',
      text: hintText,
    });

    const actions = this.contentEl.createDiv({ cls: 'mc-actions' });
    const revealButton = actions.createEl('button', { text: '揭晓答案', cls: 'mod-cta mc-reveal' });
    const ariaLabel = Platform.isMobile ? '揭晓答案' : '揭晓答案（按空格键）';
    revealButton.setAttribute('aria-label', ariaLabel);
    revealButton.addEventListener('click', () => this.reveal());
    if (!Platform.isMobile) {
      revealButton.focus();
    }
  }

  private reveal(): void {
    const card = this.current;
    if (!card || this.revealed) return;

    const thinkMs = Date.now() - this.shownAt;
    const minThink = this.store.settings.minThinkSeconds;
    if (!this.nudged && shouldNudgeBeforeReveal(thinkMs, minThink)) {
      // One gentle nudge only; the user stays in control (SPEC §8.4).
      this.nudged = true;
      new Notice('要不要再想想？主动回忆才是记住的关键。', 2500);
      return;
    }

    this.revealed = true;
    this.revealedAt = Date.now();

    // Save session state with revealed=true
    const session = SessionManager.serialize(this.queueIds, this.index, true);
    this.store.setActiveSession(session);

    const answer = this.contentEl.createDiv({ cls: 'mc-answer' });
    void MarkdownRenderer.render(this.app, card.answer, answer, card.notePath, this.owner);
    if (card.note) {
      const extra = this.contentEl.createDiv({ cls: 'mc-note' });
      void MarkdownRenderer.render(this.app, card.note, extra, card.notePath, this.owner);
    }

    this.contentEl.querySelector('.mc-actions')?.remove();
    this.contentEl.querySelector('.mc-hint')?.remove();

    const bar = this.contentEl.createDiv({ cls: 'mc-grades' });
    for (const button of GRADE_BUTTONS) {
      const el = bar.createEl('button', { cls: 'mc-grade' });
      el.createSpan({ text: button.label, cls: 'mc-grade-label' });

      const hintText = Platform.isMobile ? button.hint : `${button.key} · ${button.hint}`;
      el.createSpan({ text: hintText, cls: 'mc-grade-hint' });
      el.setAttribute('aria-label', `${button.label}：${button.hint}`);
      el.addEventListener('click', () => void this.grade(button.grade));
    }
    if (!Platform.isMobile) {
      (bar.firstElementChild as HTMLElement | null)?.focus();
    }

    const footerHint = Platform.isMobile
      ? '💡 向左/右滑动：← = 模糊，→ = 轻松'
      : '💡 按键盘 1-4，或向左/右滑动；← = 模糊，→ = 轻松';
    this.contentEl.createDiv({
      cls: 'mc-hint',
      text: footerHint,
    });

    // Adjust answer height for virtual keyboard on mobile
    this.adjustAnswerHeight();
  }

  private async grade(grade: Grade): Promise<void> {
    const card = this.current;
    if (!card || !this.revealed) return;

    const now = new Date();
    const thinkMs = this.revealedAt - this.shownAt;
    const gradeMs = Date.now() - this.revealedAt;
    const settings = this.store.settings;

    const verdict = checkTiming(
      {
        thinkMs,
        gradeMs,
        minThinkSeconds: settings.minThinkSeconds,
        minGradeSeconds: settings.minGradeSeconds,
      },
      grade
    );

    const previous = this.store.getState(card.id);
    const isNewCard = !previous || previous.lastGrade === null;
    const state = this.store.ensureState(card.id, now);
    const next = review(state, grade, now, {
      initialIntervals: settings.initialIntervals,
      lowConfidence: verdict.lowConfidence,
    });
    this.store.setState(card.id, next);
    this.store.recordReview(
      {
        cardId: card.id,
        at: now.toISOString(),
        grade,
        thinkMs,
        gradeMs,
        flag: verdict.revealedTooFast || verdict.gradedTooFast ? 'too_fast' : undefined,
        intervalDays: next.intervalDays,
      },
      now
    );
    if (isNewCard) this.store.countNewCardIntroduced(now);

    this.graded.set(card.id, grade);
    this.completed += 1;
    if (verdict.message) new Notice(verdict.message, 3500);

    const distribution = checkGradeDistribution(this.store.reviewLog, settings.minThinkSeconds);
    if (distribution.suspicious && distribution.message) {
      new Notice(distribution.message, 5000);
    }

    // Variable encouragement every 5 cards (SPEC §6).
    if (this.completed % 5 === 0) {
      new Notice(ENCOURAGEMENTS[(this.completed / 5 - 1) % ENCOURAGEMENTS.length], 2000);
    }

    this.index += 1;
    this.revealed = false;

    // Save session state after grading
    const session = SessionManager.serialize(this.queueIds, this.index, false);
    this.store.setActiveSession(session);

    this.render();
  }

  private renderSummary(): void {
    const wrapper = this.contentEl.createDiv({ cls: 'mc-summary' });
    wrapper.createEl('h2', { text: this.completed > 0 ? '这一组完成了' : '今天没有到期卡片' });

    if (this.completed > 0) {
      const again = [...this.graded.values()].filter((grade) => grade < GRADE.HARD).length;
      wrapper.createEl('p', {
        text: `复习 ${this.completed} 张，其中 ${again} 张需要再练。`,
      });
      wrapper.createEl('p', {
        cls: 'mc-hint',
        text: '到此为止也很好 — 每天一点点，比一次刷完更有效。',
      });
    } else {
      wrapper.createEl('p', {
        cls: 'mc-hint',
        text: '所有卡片都还没到复习时间。可以新建卡片，或者休息一下。',
      });
    }

    const actions = wrapper.createDiv({ cls: 'mc-summary-actions' });
    const close = actions.createEl('button', { text: '关闭', cls: 'mod-cta' });
    close.addEventListener('click', () => this.close());
    if (!Platform.isMobile) {
      close.focus();
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
