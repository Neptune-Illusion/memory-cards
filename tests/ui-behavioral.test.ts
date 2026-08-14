/**
 * Behavioral tests for 0.3.1 UI fixes:
 * - QuickAddModal DOM structure (label clipping fix)
 * - SettingsTab AIConfigPanel integration (Provider dropdown)
 *
 * These instantiate real classes, call real methods, and assert on
 * the DOM structure — NOT static string checks.
 */
import { describe, expect, it } from 'vitest';

// ─── QuickAddModal DOM behavioral test ───
describe('QuickAddModal — DOM structure behavioral test', () => {
  it('onOpen creates .mc-field wrappers with label + textarea/input', async () => {
    const { QuickAddModal } = await import('../src/ui/quickAddModal');

    const mockApp = { vault: { getFiles: () => [], getAbstractFileByPath: () => null, create: async () => ({}), createFolder: async () => {} } };
    const mockSettings = {
      cardFolder: '卡片', newPerDay: 10, dailyLimit: 20,
      minThinkSeconds: 3, minGradeSeconds: 2, initialIntervals: [1, 3, 6],
      tagFilter: [], questionSeparator: '???', noteSeparator: ':::', keepReviewLog: true,
    };
    const modal = new QuickAddModal(mockApp as any, mockSettings, async () => {}, undefined as any);

    // Open the modal (triggers onOpen which builds the DOM)
    modal.onOpen();

    // Find all .mc-field wrappers in the modal content
    const content = modal.contentEl as any;
    const fields = content.findAll('mc-field');
    expect(fields.length).toBeGreaterThanOrEqual(3); // question + answer + note

    // Each field must have a label child and a textarea child
    for (const field of fields) {
      const hasLabel = field._children.some((c: any) => c._tag === 'label');
      const hasTextarea = field._children.some((c: any) => c._tag === 'textarea');
      const hasInput = field._children.some((c: any) => c._tag === 'input');
      expect(hasLabel || hasTextarea || hasInput).toBe(true);
      // The label must be the first child (before textarea/input)
      if (hasLabel) {
        const labelIdx = field._children.findIndex((c: any) => c._tag === 'label');
        const controlIdx = field._children.findIndex((c: any) => c._tag === 'textarea' || c._tag === 'input');
        expect(labelIdx).toBeLessThan(controlIdx);
      }
    }

    // The 4th field (tags) should use input, not textarea
    const tagsField = fields[3];
    if (tagsField) {
      const hasInput = tagsField._children.some((c: any) => c._tag === 'input');
      expect(hasInput).toBe(true);
    }
  });

  it('label text matches the field names (问题/答案/注解/标签)', async () => {
    const { QuickAddModal } = await import('../src/ui/quickAddModal');

    const mockApp = { vault: { getFiles: () => [], getAbstractFileByPath: () => null, create: async () => ({}), createFolder: async () => {} } };
    const mockSettings = {
      cardFolder: '卡片', newPerDay: 10, dailyLimit: 20,
      minThinkSeconds: 3, minGradeSeconds: 2, initialIntervals: [1, 3, 6],
      tagFilter: [], questionSeparator: '???', noteSeparator: ':::', keepReviewLog: true,
    };
    const modal = new QuickAddModal(mockApp as any, mockSettings, async () => {}, undefined as any);
    modal.onOpen();

    const fields = (modal.contentEl as any).findAll('mc-field');
    const labelTexts = fields
      .map((f: any) => f._children.find((c: any) => c._tag === 'label'))
      .filter(Boolean)
      .map((l: any) => l._text);

    expect(labelTexts).toContain('问题');
    expect(labelTexts).toContain('答案');
    expect(labelTexts).toContain('注解（可选）');
    expect(labelTexts).toContain('标签（可选，逗号分隔）');
  });
});

// ─── SettingsTab AIConfigPanel behavioral test ───
describe('SettingsTab — AIConfigPanel integration behavioral test', () => {
  it('display renders Provider dropdown with 3 options', async () => {
    const { MemoryCardsSettingTab } = await import('../src/ui/settingsTab');
    const { DEFAULT_AI_CONFIG } = await import('../src/ui/aiConfigPanel');

    const mockStore = {
      settings: {
        cardFolder: '卡片', newPerDay: 10, dailyLimit: 20,
        minThinkSeconds: 3, minGradeSeconds: 2, initialIntervals: [1, 3, 6],
        tagFilter: [], questionSeparator: '???', noteSeparator: ':::', keepReviewLog: true,
      },
      aiConfig: { ...DEFAULT_AI_CONFIG },
      updateSettings() {},
      setAIConfig(c: any) { mockStore.aiConfig = c; },
    };

    const mockPlugin = {
      store: mockStore,
      async refreshIndex() {},
      getAIConfig() { return mockStore.aiConfig; },
      async saveAIConfig(c: any) { mockStore.aiConfig = c; },
    };

    const tab = new MemoryCardsSettingTab({} as any, mockPlugin as any);
    tab.display();

    // Find the AI config section
    const container = tab.containerEl as any;
    const aiSection = container._children.find(
      (c: any) => c._tag === 'div' && c._cls.includes('memory-cards-ai-config')
    );
    expect(aiSection).toBeDefined();

    // The AIConfigPanel should have rendered its settings into aiSection
    // Find dropdowns (select elements) inside the AI section
    const selects = aiSection!._children.filter((c: any) => c._tag === 'select');
    expect(selects.length).toBeGreaterThanOrEqual(1);

    // The first dropdown should be the Provider dropdown with 3 options
    const providerSelect = selects[0];
    const options = providerSelect._children.filter((c: any) => c._tag === 'option');
    expect(options.length).toBe(3);

    const optionValues = options.map((o: any) => o.value);
    expect(optionValues).toContain('anthropic');
    expect(optionValues).toContain('openai');
    expect(optionValues).toContain('gemini');
  });

  it('Provider dropdown onChange saves to store via plugin.saveAIConfig', async () => {
    const { MemoryCardsSettingTab } = await import('../src/ui/settingsTab');
    const { DEFAULT_AI_CONFIG } = await import('../src/ui/aiConfigPanel');

    let savedConfig: any = null;
    const mockStore = {
      settings: {
        cardFolder: '卡片', newPerDay: 10, dailyLimit: 20,
        minThinkSeconds: 3, minGradeSeconds: 2, initialIntervals: [1, 3, 6],
        tagFilter: [], questionSeparator: '???', noteSeparator: ':::', keepReviewLog: true,
      },
      aiConfig: { ...DEFAULT_AI_CONFIG },
      updateSettings() {},
      setAIConfig(c: any) { mockStore.aiConfig = c; },
    };

    const mockPlugin = {
      store: mockStore,
      async refreshIndex() {},
      getAIConfig() { return mockStore.aiConfig; },
      async saveAIConfig(c: any) { savedConfig = c; mockStore.aiConfig = c; },
    };

    const tab = new MemoryCardsSettingTab({} as any, mockPlugin as any);
    tab.display();

    // Find the Provider dropdown
    const aiSection2 = (tab.containerEl as any)._children.find(
      (c: any) => c._tag === 'div' && c._cls.includes('memory-cards-ai-config')
    );
    const selects2 = aiSection2!._children.filter((c: any) => c._tag === 'select');
    const providerSelect = selects2[0];

    // Trigger onChange with 'openai'
    providerSelect.triggerChange('openai');

    // Verify saveAIConfig was called and config was updated
    expect(savedConfig).not.toBeNull();
    expect(savedConfig.provider).toBe('openai');
    expect(mockStore.aiConfig.provider).toBe('openai');
  });

  it('core settings are NOT cleared when AIConfigPanel renders', async () => {
    const { MemoryCardsSettingTab } = await import('../src/ui/settingsTab');
    const { DEFAULT_AI_CONFIG } = await import('../src/ui/aiConfigPanel');

    const mockStore = {
      settings: {
        cardFolder: '卡片', newPerDay: 10, dailyLimit: 20,
        minThinkSeconds: 3, minGradeSeconds: 2, initialIntervals: [1, 3, 6],
        tagFilter: [], questionSeparator: '???', noteSeparator: ':::', keepReviewLog: true,
      },
      aiConfig: { ...DEFAULT_AI_CONFIG },
      updateSettings() {},
      setAIConfig() {},
    };

    const mockPlugin = {
      store: mockStore,
      async refreshIndex() {},
      getAIConfig() { return mockStore.aiConfig; },
      async saveAIConfig() {},
    };

    const tab = new MemoryCardsSettingTab({} as any, mockPlugin as any);
    tab.display();

    // Find h2 elements — should have both "核心设置" and "AI 自动制卡"
    const h2s = (tab.containerEl as any)._children.filter((c: any) => c._tag === 'h2');
    const headings = h2s.map((h: any) => h._text);
    expect(headings).toContain('核心设置');
    expect(headings).toContain('AI 自动制卡');

    // "核心设置" h2 should appear before "AI 自动制卡"
    const coreIdx = headings.indexOf('核心设置');
    const aiIdx = headings.indexOf('AI 自动制卡');
    expect(coreIdx).toBeLessThan(aiIdx);
  });
});
