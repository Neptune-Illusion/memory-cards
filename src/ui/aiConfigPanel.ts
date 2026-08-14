import { App, PluginSettingTab, Setting } from 'obsidian';
import type MemoryCardsPlugin from '../main';
import type { ProviderType } from '../ai/aiProvider';
import { PROVIDER_DEFAULTS } from '../ai/aiProvider';

export type GenerationDensity = 'low' | 'standard' | 'high';

/** Cards per chunk target per density level. */
export const DENSITY_CARDS_PER_CHUNK: Record<GenerationDensity, number> = {
  low: 2,
  standard: 5,
  high: 10,
};

export interface AIConfig {
  provider: ProviderType;
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  generationDensity: GenerationDensity;
  maxCards: number;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'anthropic',
  apiKey: '',
  model: PROVIDER_DEFAULTS.anthropic.model,
  baseUrl: PROVIDER_DEFAULTS.anthropic.baseUrl,
  temperature: 0.3,
  maxTokens: 4096,
  generationDensity: 'standard',
  maxCards: 100,
};

/**
 * Normalize a potentially outdated config (e.g. from v0.2.0):
 * - provider 'claude' → 'anthropic'
 * - endpoint → baseUrl
 * - missing density/maxCards → defaults
 */
export function normalizeAIConfig(raw: Partial<AIConfig>): AIConfig {
  // Migrate before spread so endpoint doesn't get overwritten by defaults
  const migrated = { ...raw } as any;
  if (migrated.provider === 'claude') migrated.provider = 'anthropic';
  if (migrated.endpoint && !migrated.baseUrl) {
    migrated.baseUrl = migrated.endpoint;
  }
  const cfg = { ...DEFAULT_AI_CONFIG, ...migrated } as AIConfig;
  // Ensure valid provider
  if (!PROVIDER_DEFAULTS[cfg.provider]) cfg.provider = 'anthropic';
  // Clamp maxCards
  cfg.maxCards = cfg.maxCards != null ? Math.max(1, Math.min(500, cfg.maxCards)) : DEFAULT_AI_CONFIG.maxCards;
  // Ensure valid density
  if (!DENSITY_CARDS_PER_CHUNK[cfg.generationDensity]) {
    cfg.generationDensity = 'standard';
  }
  return cfg;
}

const PROVIDER_LABELS: Record<ProviderType, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI-compatible',
  gemini: 'Google Gemini',
};

const DENSITY_LABELS: Record<GenerationDensity, string> = {
  low: '低密度（每块 ~2 卡）',
  standard: '标准（每块 ~5 卡）',
  high: '高密度（每块 ~10 卡）',
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
      .setName('Provider')
      .setDesc('选择 AI 服务提供商')
      .addDropdown((drop) =>
        drop
          .addOptions(PROVIDER_LABELS)
          .setValue(config.provider)
          .onChange(async (value: string) => {
            const provider = value as ProviderType;
            config.provider = provider;
            const defaults = PROVIDER_DEFAULTS[provider];
            if (!config.model || config.model === PROVIDER_DEFAULTS[config.provider]?.model) {
              config.model = defaults.model;
            }
            config.baseUrl = defaults.baseUrl;
            await this.plugin.saveAIConfig(config);
            this.display();
          })
      );

    new Setting(containerEl)
      .setName('API Key')
      .setDesc('API 密钥（不会明文写入日志）')
      .addText((text) =>
        text
          .setPlaceholder('sk-...')
          .setValue(config.apiKey)
          .onChange(async (value) => {
            config.apiKey = value;
            await this.plugin.saveAIConfig(config);
          })
      );

    new Setting(containerEl)
      .setName('模型')
      .setDesc('模型名称')
      .addText((text) =>
        text
          .setPlaceholder(PROVIDER_DEFAULTS[config.provider].model)
          .setValue(config.model)
          .onChange(async (value) => {
            config.model = value;
            await this.plugin.saveAIConfig(config);
          })
      );

    new Setting(containerEl)
      .setName('API Base URL')
      .setDesc('API 端点（默认官方，可改为代理/本地）')
      .addText((text) =>
        text
          .setPlaceholder(PROVIDER_DEFAULTS[config.provider].baseUrl)
          .setValue(config.baseUrl ?? '')
          .onChange(async (value) => {
            config.baseUrl = value || undefined;
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

    new Setting(containerEl)
      .setName('生成密度')
      .setDesc('每个文本片段生成的卡片数量')
      .addDropdown((drop) =>
        drop
          .addOptions(DENSITY_LABELS)
          .setValue(config.generationDensity)
          .onChange(async (value: string) => {
            config.generationDensity = value as GenerationDensity;
            await this.plugin.saveAIConfig(config);
          })
      );

    new Setting(containerEl)
      .setName('最大卡片数')
      .setDesc('总卡数硬上限（1-500）')
      .addText((text) =>
        text
          .setPlaceholder('100')
          .setValue(String(config.maxCards))
          .onChange(async (value) => {
            config.maxCards = Math.max(1, Math.min(500, parseInt(value) || 100));
            await this.plugin.saveAIConfig(config);
          })
      );
  }
}
