import { Modal, type App } from 'obsidian';

/**
 * Lightweight confirm dialog that resolves a Promise.
 * Used for continue/abandon session choice.
 */
export class ConfirmDialog extends Promise<'confirm' | 'cancel'> {
  constructor(
    app: App,
    title: string,
    message: string,
    confirmText = '确认',
    cancelText = '取消'
  ) {
    let resolveFn: (value: 'confirm' | 'cancel') => void;
    super((resolve) => {
      resolveFn = resolve;
    });

    const modal = new Modal(app);
    modal.modalEl.addClass('memory-cards-modal');
    modal.titleEl.setText(title);
    modal.contentEl.createEl('p', { text: message });

    const btnRow = modal.contentEl.createDiv({ cls: 'mc-actions' });
    const confirmBtn = btnRow.createEl('button', { text: confirmText, cls: 'mod-cta' });
    confirmBtn.addEventListener('click', () => {
      modal.close();
      resolveFn!('confirm');
    });
    const cancelBtn = btnRow.createEl('button', { text: cancelText });
    cancelBtn.addEventListener('click', () => {
      modal.close();
      resolveFn!('cancel');
    });

    modal.open();
  }
}
