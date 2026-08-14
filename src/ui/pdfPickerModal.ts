import { Modal, TFile, type App } from 'obsidian';

/**
 * Mobile-first PDF file picker. Lists all .pdf files in the vault.
 * Returns the selected file or null if dismissed.
 */
export class PDFPickerModal extends Modal {
  private resolveFn: (file: TFile | null) => void = () => {};

  constructor(app: App) {
    super(app);
  }

  open(): Promise<TFile | null> {
    return new Promise<TFile | null>((resolve) => {
      this.resolveFn = resolve;
      super.open();
    });
  }

  onOpen(): void {
    this.modalEl.addClass('memory-cards-modal');
    this.contentEl.createEl('h2', { text: '选择 PDF 文件' });

    const pdfs = this.app.vault.getFiles().filter((f) => f.extension === 'pdf');

    if (pdfs.length === 0) {
      this.contentEl.createEl('p', {
        text: 'Vault 中没有 PDF 文件。',
        cls: 'mc-hint',
      });
      return;
    }

    const list = this.contentEl.createDiv({ cls: 'mc-pdf-list' });
    for (const file of pdfs) {
      const row = list.createDiv({ cls: 'mc-pdf-row' });
      const btn = row.createEl('button', {
        text: file.basename,
        cls: 'mc-pdf-item',
      });
      btn.addEventListener('click', () => {
        this.close();
        this.resolveFn(file);
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
    this.resolveFn(null);
  }
}
