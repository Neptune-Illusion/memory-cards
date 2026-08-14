import { Modal, type App } from 'obsidian';
import type { Stats } from '../stats';

/** Dashboard (SPEC §5). Shows a small honest picture, never a pressuring backlog list. */
export class StatsModal extends Modal {
  constructor(
    app: App,
    private readonly stats: Stats,
    private readonly antiCheatOn: boolean
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass('memory-cards-modal');
    this.contentEl.createEl('h2', { text: '记忆卡统计' });

    const grid = this.contentEl.createDiv({ cls: 'mc-stats-grid' });
    this.tile(grid, '今日到期', `${this.stats.dueToday}`);
    this.tile(grid, '今日已复习', `${this.stats.reviewedToday}`);
    this.tile(grid, '连续打卡', `${this.stats.streak} 天`);
    this.tile(grid, '卡片总数', `${this.stats.totalCards}`);
    this.tile(grid, '未学新卡', `${this.stats.newCards}`);
    this.tile(grid, '成熟卡占比', `${Math.round(this.stats.matureRatio * 100)}%`);
    this.tile(grid, '平均难度系数', `${this.stats.averageEase || '—'}`);

    if (this.antiCheatOn) {
      this.contentEl.createEl('h3', { text: '数据质量（最近 50 次）' });
      const quality = this.contentEl.createDiv({ cls: 'mc-stats-grid' });
      this.tile(quality, '平均思考时长', `${(this.stats.averageThinkMs / 1000).toFixed(1)}s`);
      this.tile(quality, '过快揭晓比例', `${Math.round(this.stats.fastRevealRatio * 100)}%`);
      this.tile(quality, '正确/轻松比例', `${Math.round(this.stats.highGradeRatio * 100)}%`);
      if (this.stats.highGradeRatio > 0.85 && this.stats.fastRevealRatio > 0.5) {
        this.contentEl.createEl('p', {
          cls: 'mc-hint',
          text: '评分偏高、思考偏短 — 按真实回忆程度评分，安排才会真的帮到你。',
        });
      }
    }

    const close = this.contentEl.createEl('button', { text: '关闭', cls: 'mod-cta' });
    close.addEventListener('click', () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private tile(parent: HTMLElement, label: string, value: string): void {
    const tile = parent.createDiv({ cls: 'mc-tile' });
    tile.createDiv({ cls: 'mc-tile-value', text: value });
    tile.createDiv({ cls: 'mc-tile-label', text: label });
  }
}
