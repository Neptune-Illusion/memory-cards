import { PluginSettingTab, Setting, type App } from 'obsidian';
import type MemoryCardsPlugin from '../main';
import { DEFAULT_SETTINGS } from '../types';

/** Settings (SPEC §9). Everything has a working default; nothing blocks first use. */
export class MemoryCardsSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: MemoryCardsPlugin
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const settings = this.plugin.store.settings;

    new Setting(containerEl)
      .setName('卡片文件夹')
      .setDesc('递归读取该文件夹下所有笔记。留空表示整个 vault。')
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.cardFolder)
          .setValue(settings.cardFolder)
          .onChange(async (value) => {
            this.plugin.store.updateSettings({ cardFolder: value.trim() });
            await this.plugin.refreshIndex();
          })
      );

    new Setting(containerEl)
      .setName('每日新卡上限')
      .setDesc('0 = 不引入新卡。')
      .addText((text) =>
        text.setValue(`${settings.newPerDay}`).onChange((value) => {
          this.plugin.store.updateSettings({ newPerDay: toInt(value, DEFAULT_SETTINGS.newPerDay) });
        })
      );

    new Setting(containerEl)
      .setName('每日复习上限')
      .setDesc('0 = 无限制。')
      .addText((text) =>
        text.setValue(`${settings.dailyLimit}`).onChange((value) => {
          this.plugin.store.updateSettings({ dailyLimit: toInt(value, DEFAULT_SETTINGS.dailyLimit) });
        })
      );

    new Setting(containerEl)
      .setName('揭晓最小思考时长（秒）')
      .setDesc('低于该时长揭晓会收到一次温和提示；0 = 关闭。')
      .addText((text) =>
        text.setValue(`${settings.minThinkSeconds}`).onChange((value) => {
          this.plugin.store.updateSettings({
            minThinkSeconds: toInt(value, DEFAULT_SETTINGS.minThinkSeconds),
          });
        })
      );

    new Setting(containerEl)
      .setName('评分最小时长（秒）')
      .setDesc('揭晓到评分过快会提示；0 = 关闭。')
      .addText((text) =>
        text.setValue(`${settings.minGradeSeconds}`).onChange((value) => {
          this.plugin.store.updateSettings({
            minGradeSeconds: toInt(value, DEFAULT_SETTINGS.minGradeSeconds),
          });
        })
      );

    new Setting(containerEl)
      .setName('新手期间隔（天）')
      .setDesc('逗号分隔，默认 1, 3, 6。')
      .addText((text) =>
        text.setValue(settings.initialIntervals.join(', ')).onChange((value) => {
          const parsed = value
            .split(',')
            .map((part) => Number.parseInt(part.trim(), 10))
            .filter((num) => Number.isFinite(num) && num > 0);
          this.plugin.store.updateSettings({
            initialIntervals: parsed.length > 0 ? parsed : DEFAULT_SETTINGS.initialIntervals,
          });
        })
      );

    new Setting(containerEl)
      .setName('主题过滤（标签）')
      .setDesc('逗号分隔；留空表示复习全部卡片。')
      .addText((text) =>
        text.setValue(settings.tagFilter.join(', ')).onChange((value) => {
          this.plugin.store.updateSettings({
            tagFilter: value
              .split(',')
              .map((tag) => tag.trim().replace(/^#/, ''))
              .filter((tag) => tag.length > 0),
          });
        })
      );

    new Setting(containerEl)
      .setName('问题/答案分隔符')
      .addText((text) =>
        text.setValue(settings.questionSeparator).onChange(async (value) => {
          if (value.trim().length === 0) return;
          this.plugin.store.updateSettings({ questionSeparator: value.trim() });
          await this.plugin.refreshIndex();
        })
      );

    new Setting(containerEl)
      .setName('注解分隔符')
      .addText((text) =>
        text.setValue(settings.noteSeparator).onChange(async (value) => {
          if (value.trim().length === 0) return;
          this.plugin.store.updateSettings({ noteSeparator: value.trim() });
          await this.plugin.refreshIndex();
        })
      );

    new Setting(containerEl)
      .setName('记录复习日志')
      .setDesc('用于统计与数据质量提示，存在 data.json 中。')
      .addToggle((toggle) =>
        toggle.setValue(settings.keepReviewLog).onChange((value) => {
          this.plugin.store.updateSettings({ keepReviewLog: value });
        })
      );
  }
}

function toInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
