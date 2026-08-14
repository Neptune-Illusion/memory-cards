import { Modal, type App } from 'obsidian';
import type { ConfirmResult } from './confirmResult';

/** Minimal Modal surface used by ConfirmDialog, injectable for tests. */
/** Minimal element surface (mirrors Obsidian's createEl/createDiv). */
export interface ConfirmElementLike {
  addEventListener(type: string, listener: (ev: Event) => void): void;
  createEl(tag: string, opts?: { text?: string; cls?: string } | string): ConfirmElementLike;
  createDiv(opts?: { text?: string; cls?: string } | string): ConfirmElementLike;
}

/** Minimal Modal surface used by ConfirmDialog, injectable for tests. */
export interface ConfirmModalLike {
  modalEl: { addClass(cls: string): void };
  titleEl: { setText(text: string): void };
  contentEl: ConfirmElementLike;
  open(): void;
  close(): void;
  onClose: (() => void) | null;
}

/**
 * Pure decision state: settles exactly once. Separated from the UI so the
 * resolve-once contract is unit-testable without a DOM.
 */
export class ConfirmDecision {
  private settled = false;
  constructor(private readonly resolveFn: (value: ConfirmResult) => void) {}

  settle(result: ConfirmResult): boolean {
    if (this.settled) return false;
    this.settled = true;
    this.resolveFn(result);
    return true;
  }

  get isSettled(): boolean {
    return this.settled;
  }
}

/**
 * Lightweight confirm dialog that resolves a Promise exactly once.
 *
 * Mobile-safe contract:
 * - "继续/放弃" settle the decision BEFORE closing the modal, so the
 *   DOM teardown can never cancel the pending click resolution.
 * - Closing by any other path (X / overlay / Escape) resolves with
 *   'dismiss' instead of leaving the promise pending forever.
 * - ConfirmDecision's settled guard makes double resolution impossible,
 *   even if a button click and onClose both fire for one interaction.
 */
export class ConfirmDialog {
  private readonly promise: Promise<ConfirmResult>;
  private decision!: ConfirmDecision;

  constructor(
    app: App,
    title: string,
    message: string,
    confirmText = '确认',
    cancelText = '取消',
    modalFactory: (app: App) => ConfirmModalLike = (a) => new Modal(a)
  ) {
    this.promise = new Promise<ConfirmResult>((resolve) => {
      this.decision = new ConfirmDecision(resolve);
    });

    const modal = modalFactory(app);
    modal.modalEl.addClass('memory-cards-modal');
    modal.titleEl.setText(title);
    modal.contentEl.createEl('p', { text: message });

    const btnRow = modal.contentEl.createDiv({ cls: 'mc-actions' });
    const confirmBtn = btnRow.createEl('button', { text: confirmText, cls: 'mod-cta' });
    confirmBtn.addEventListener('click', () => {
      // Resolve before close: the awaiting caller resumes after this handler
      // completes, so opening the next modal is never swallowed by teardown.
      this.decision.settle('confirm');
      modal.close();
    });
    const cancelBtn = btnRow.createEl('button', { text: cancelText });
    cancelBtn.addEventListener('click', () => {
      this.decision.settle('cancel');
      modal.close();
    });

    // Any close path that is not one of the two buttons resolves as dismiss,
    // so the caller never waits forever.
    modal.onClose = () => {
      this.decision.settle('dismiss');
    };

    modal.open();
  }

  /** The decision promise. Resolves exactly once with confirm/cancel/dismiss. */
  then<TResult1 = ConfirmResult, TResult2 = never>(
    onfulfilled?: ((value: ConfirmResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected);
  }
}
