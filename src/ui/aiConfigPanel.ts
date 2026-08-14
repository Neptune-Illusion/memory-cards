import { App, PluginSettingTab, Setting } from 'obsidian';
import type MemoryCardsPlugin from '../main';

export interface AIConfig {
  provider: 'claude';
  apiKey: string;
  model: string;
  endpoint?: string;
  temperature?: number;
  maxTokens?: number;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'claude',
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  endpoint: 'https://api.anthropic.com/v1/messages',
  temperature: 0.3,
  maxTokens: 4096,
};

export class AIConfigPanel extends PluginSettingTab {
  plugin: MemoryCardsPlugin;

  constructor(app: App, plugin: MemoryCardsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'AI 自动制卡设置' });

    const config = this.plugin.getAIConfig();

    new Setting(containerEl)
      .setName('API Key')
      .setDesc('Claude API 密钥（不会明文写入日志）')
      .addText((text) =>
        text
          .setPlaceholder('sk-ant-...')
          .setValue(config.apiKey)
          .onChange(async (value) => {
            config.apiKey = value;
            await this.plugin.saveAIConfig(config);
          })
      );

    new Setting(containerEl)
      .setName('模型')
      .setDesc('Claude 模型名称')
      .addText((text) =>
        text
          .setPlaceholder('claude-sonnet-4-20250514')
          .setValue(config.model)
          .onChange(async (value) => {
            config.model = value;
            await this.plugin.saveAIConfig(config);
          })
      );

    new Setting(containerEl)
      .setName('API Endpoint')
      .setDesc('Claude API 端点（默认官方，可改为代理）')
      .addText((text) =>
        text
          .setPlaceholder('https://api.anthropic.com/v1/messages')
          .setValue(config.endpoint ?? '')
          .onChange(async (value) => {
            config.endpoint = value || undefined;
            await this.plugin.saveAIConfig(config);
          })
      );

    new Setting(containerEl)
      .setName('Temperature')
      .setDesc('生成温度 (0-1)，越低越确定')
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.1)
          .setValue(config.temperature ?? 0.3)
          .setDynamicTooltip()
          .onChange(async (value) => {
            config.temperature = value;
            await this.plugin.saveAIConfig(config);
          })
      );

    new Setting(containerEl)
      .setName('Max Tokens')
      .setDesc('最大输出 token 数')
      .addText((text) =>
        text
          .setPlaceholder('4096')
          .setValue(String(config.maxTokens ?? 4096))
          .onChange(async (value) => {
            config.maxTokens = parseInt(value) || 4096;
            await this.plugin.saveAIConfig(config);
          })
      );
  }
}
