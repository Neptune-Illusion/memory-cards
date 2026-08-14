# PDF AI 自动制卡方案设计 — Claudian 集成路径分析

**日期**: 2026-08-15  
**项目**: Memory Cards v0.1.2  
**目标**: 设计可落地的 PDF 文本提取 + AI 自动生成卡片方案，评估 Claudian 集成路径

---

## 1. 需求概述

### 用户工作流
1. **输入**: 用户在桌面/移动端选择 vault 内的 PDF 文件
2. **提取**: 提取文本（含扫描件 OCR 降级处理）
3. **生成**: 调用可配置 AI agent 生成结构化 memory cards
4. **预览编辑**: 先预览、编辑、去重，再批量写入
5. **容错**: 失败可恢复，不泄露数据

### 核心约束
- **移动端优先**: Obsidian Mobile（iOS/Android）是主要场景
- **数据安全**: 不上传用户 vault 到不信任的服务
- **模块化**: AI provider 可配置（Claude/其他 LLM）
- **可离线**: PDF 提取本地完成，仅 AI 生成需网络

---

## 2. 技术架构

### 2.1 集成路径对比

| 路径 | 方案 | 优点 | 缺点 | 推荐场景 |
|------|------|------|------|---------|
| **A: 直接依赖 Claudian** | Memory Cards 作为 Claudian 插件的消费方，通过 Obsidian 事件总线通信 | 充分复用 Claudian UI/认证，紧密集成 | 强耦合，Claudian 版本升级影响大；需要 Claudian 已安装 | 用户同时使用两个插件的场景 |
| **B: 命令/URI 协议** | Memory Cards 通过 `obsidian://` URI 或命令行调用 Claudian API 端点 | 松耦合，Claudian 可选；Memory Cards 独立可用 | 需要约定协议版本，维护成本高；Claudian 需暴露 API | 长期，稳定生态系统 |
| **C: 文件契约** | Memory Cards 生成 prompt 文件，Claudian 读取；结果写回标准格式 | 完全解耦，支持多 AI provider；可离线测试 | 实现复杂，文件 I/O 开销；需手动触发 | 短期 MVP，快速验证 |
| **D: 内置 provider** | Memory Cards 内置 Claude API 客户端 + 其他 LLM（OpenAI/本地等） | 完全独立，用户无需安装 Claudian；支持多 provider | 需要 API Key 管理，安全考量（Key 存储）；维护多 provider 成本高 | 需要真正通用的卡片生成工具 |

### 2.2 推荐方案: 混合 B + D 路径

**分阶段实现策略**：

```
Phase 1 (MVP, v0.2): 内置简单 Claude API 支持 (路径 D)
  ├─ 用户在设置中配置 Claude API Key
  ├─ Memory Cards 内置 PDF 提取器（pdfjs-dist）
  ├─ 调用 Claude API 直接生成卡片
  └─ 本地预览、编辑、批量写入

Phase 2 (v0.3): Claudian 可选集成 (路径 B 草稿)
  ├─ 定义 Memory Cards ← → Claudian 消息契约
  ├─ 检测 Claudian 是否安装，若有则提供"使用 Claudian 生成"选项
  ├─ 通过 Obsidian 事件/window 对象通信（非正式 API）
  └─ 回退到内置 Claude API

Phase 3 (长期): 标准化 API (路径 B 正式)
  ├─ 与 Claudian 团队协商标准 API 协议
  ├─ 发布官方集成文档
  └─ 支持第三方 AI 客户端插件
```

**理由**:
- **Phase 1** 快速上线，不依赖 Claudian，用户体验完整
- **Phase 2** 为有 Claudian 的用户提供额外选项，逐步测试协议
- **Phase 3** 如果生态成熟，正式化协议

---

## 3. Phase 1 MVP 架构细节

### 3.1 模块结构

```
src/
├── pdf/
│   ├── pdfExtractor.ts       // PDF → 文本提取（pdfjs-dist）
│   ├── ocrFallback.ts         // 扫描件降级提示
│   └── pdfExtractor.test.ts   // 提取器测试
├── ai/
│   ├── aiProvider.ts          // AI provider 抽象接口
│   ├── claudeProvider.ts       // Claude API 实现（内置）
│   ├── claudianBridge.ts       // Claudian 可选集成（Phase 2）
│   └── aiProvider.test.ts      // Provider 抽象测试
├── cardGeneration/
│   ├── cardGenerator.ts        // AI prompt 编排 + 解析
│   ├── cardSchema.ts           // 生成卡片的 schema（JSON）
│   ├── cardDeduplicator.ts     // 去重逻辑
│   └── cardGenerator.test.ts   // 生成器测试
├── ui/
│   ├── pdfPickerModal.ts       // PDF 文件选择器（移动优先）
│   ├── cardPreviewModal.ts     // 生成卡片预览 + 编辑
│   ├── aiConfigPanel.ts        // AI 配置（Key、模型选择）
│   └── pdfPickerModal.test.ts  // UI 交互测试
└── store.ts (扩展)
    └── 新增 aiConfig 字段
```

### 3.2 核心流程（Phase 1）

```typescript
// 用户触发："从 PDF 生成卡片"
async function generateCardsFromPDF() {
  // Step 1: 选择 PDF
  const pdfFile = await new PDFPickerModal(app).open();
  
  // Step 2: 提取文本
  const text = await PDFExtractor.extract(pdfFile);
  if (!text) {
    // 扫描件降级：提示用户需手动 OCR
    new Notice("无法识别文本。如是扫描件，请使用外部 OCR 工具。");
    return;
  }
  
  // Step 3: 调用 AI provider
  const provider = aiProviderFactory.create(store.settings.aiProvider);
  const prompt = buildCardGenerationPrompt(text, store.settings);
  const response = await provider.generate(prompt);
  
  // Step 4: 解析卡片
  const cards = parseGeneratedCards(response);
  
  // Step 5: 去重
  const deduped = deduplicateCards(cards, index.cards);
  
  // Step 6: 预览 + 编辑
  const approved = await new CardPreviewModal(app, deduped).open();
  
  // Step 7: 批量写入
  for (const card of approved) {
    await cardIndex.createCardFromGenerated(card);
  }
  
  new Notice(`成功导入 ${approved.length} 张卡片。`);
}
```

### 3.3 AI Provider 接口设计

```typescript
// src/ai/aiProvider.ts
export interface AIProvider {
  /** 检查配置是否完整（Key 存在、可连接等） */
  validate(): Promise<boolean>;
  
  /** 生成卡片 */
  generate(prompt: string): Promise<string>;
  
  /** 流式生成（移动端渲染进度） */
  generateStream?(prompt: string): AsyncGenerator<string>;
  
  /** 模型列表（用于设置选项） */
  listModels?(): Promise<string[]>;
}

export interface GenerationConfig {
  aiProvider: 'claude' | 'claudian' | 'openai'; // 可扩展
  claudeApiKey?: string; // 内置 Claude
  claudeModel?: string;  // 'claude-3-5-sonnet' 等
  
  // Phase 2: Claudian 集成
  useClaudianIfAvailable?: boolean;
  
  // 生成参数
  temperature?: number;
  maxTokens?: number;
  cardCountTarget?: number; // 期望生成卡片数
}
```

### 3.4 卡片生成 Prompt 设计

```typescript
// src/cardGeneration/cardGenerator.ts
function buildCardGenerationPrompt(
  text: string,
  settings: MemoryCardsSettings
): string {
  return `你是一个专业的学习卡片设计师。基于以下文本，生成高质量的记忆卡片。

【生成规则】
1. 每张卡片应包含：问题、答案、可选的注解（为什么这个答案重要或容易忘记）
2. 问题应简洁、具体，避免是/否问题
3. 答案应完整、可自含，无需参考原文
4. 注解应提供记忆技巧或核心概念
5. 优先生成 ${settings.newPerDay} 张高质量卡片，而非大量低质量卡片

【生成格式（JSON）】
\`\`\`json
{
  "cards": [
    {
      "question": "细胞呼吸分几个阶段？",
      "answer": "三个阶段：糖酵解、柠檬酸循环、氧化磷酸化",
      "note": "糖酵解在细胞质，后两者在线粒体"
    }
  ]
}
\`\`\`

【待生成文本】
${text.slice(0, 4000)} ${text.length > 4000 ? '\n\n... [文本已截断]' : ''}`;
}
```

### 3.5 卡片去重策略

```typescript
// src/cardGeneration/cardDeduplicator.ts
interface DedupeConfig {
  /** 相似度阈值 (0-1)，>= 该值认为重复 */
  similarityThreshold: number;
  /** 检查范围：当前索引卡片 vs AI 生成卡片 */
  checkExisting: boolean;
}

function deduplicateCards(
  generated: Card[],
  existing: Card[],
  config: DedupeConfig
): Card[] {
  const seen = new Set<string>();
  const result: Card[] = [];
  
  // 规范化文本（小写、去标点、去空格）
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w]/g, '');
  
  for (const card of generated) {
    const norm = normalize(card.question + card.answer);
    
    // 与已生成卡片比较
    if (seen.has(norm)) continue;
    
    // 与现有卡片比较
    if (config.checkExisting) {
      const isDuplicate = existing.some(
        (existing) =>
          similarity(normalize(card.question), normalize(existing.question)) >=
          config.similarityThreshold
      );
      if (isDuplicate) continue;
    }
    
    seen.add(norm);
    result.push(card);
  }
  
  return result;
}

// 简单 Jaro-Winkler 相似度
function similarity(a: string, b: string): number {
  // 实现 Jaro-Winkler 或使用轻量库（string-similarity）
  return 0; // 占位
}
```

### 3.6 UI: CardPreviewModal（移动优先）

```typescript
// src/ui/cardPreviewModal.ts
export class CardPreviewModal extends Modal {
  private cards: Card[];
  private selected: Set<number>;
  private currentIndex: number;
  
  async open(): Promise<Card[]> {
    this.cards = /* 待生成卡片 */;
    this.selected = new Set(this.cards.map((_, i) => i)); // 默认全选
    this.currentIndex = 0;
    
    return super.open().then(() => this.getApprovedCards());
  }
  
  onOpen(): void {
    this.containerEl.classList.add('mc-card-preview-modal');
    this.renderCard(this.currentIndex);
    this.renderActions();
  }
  
  private renderCard(index: number): void {
    const card = this.cards[index];
    
    // 问题区
    const question = createEl('div', { cls: 'mc-preview-question' });
    question.textContent = card.question;
    
    // 答案区（可编辑）
    const answer = createEl('textarea', {
      cls: 'mc-preview-answer',
      attr: { value: card.answer },
    });
    
    // 注解区（可编辑）
    const note = createEl('textarea', {
      cls: 'mc-preview-note',
      attr: { placeholder: '可选注解', value: card.note || '' },
    });
    
    // 卡片编号 + 复选框
    const header = createEl('div', { cls: 'mc-preview-header' });
    const checkbox = createEl('input', {
      attr: { type: 'checkbox', checked: this.selected.has(index) },
    });
    checkbox.addEventListener('change', (e) => {
      if ((e.target as HTMLInputElement).checked) {
        this.selected.add(index);
      } else {
        this.selected.delete(index);
      }
    });
    
    header.appendChild(checkbox);
    createEl('span', { cls: 'mc-preview-number', text: `${index + 1}/${this.cards.length}` });
    
    this.contentEl.empty();
    this.contentEl.appendChild(header);
    this.contentEl.appendChild(question);
    this.contentEl.appendChild(answer);
    this.contentEl.appendChild(note);
  }
  
  private renderActions(): void {
    const actions = createEl('div', { cls: 'mc-preview-actions' });
    
    // 上一张、下一张（触控友好）
    const btnPrev = createEl('button', {
      cls: 'mc-btn-secondary',
      text: '上一张',
      attr: { 'touch-action': 'manipulation' },
    });
    btnPrev.addEventListener('click', () => {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.renderCard(this.currentIndex);
      }
    });
    
    const btnNext = createEl('button', {
      cls: 'mc-btn-secondary',
      text: '下一张',
      attr: { 'touch-action': 'manipulation' },
    });
    btnNext.addEventListener('click', () => {
      if (this.currentIndex < this.cards.length - 1) {
        this.currentIndex++;
        this.renderCard(this.currentIndex);
      }
    });
    
    // 导入选中卡片
    const btnImport = createEl('button', {
      cls: 'mc-btn-primary',
      text: `导入 (${this.selected.size}/${this.cards.length})`,
      attr: { 'touch-action': 'manipulation' },
    });
    btnImport.addEventListener('click', () => {
      this.close();
      this.resolve(this.getApprovedCards());
    });
    
    actions.appendChild(btnPrev);
    actions.appendChild(btnNext);
    actions.appendChild(btnImport);
    this.contentEl.appendChild(actions);
  }
  
  private getApprovedCards(): Card[] {
    return Array.from(this.selected).map((i) => this.cards[i]);
  }
}
```

### 3.7 CSS: 移动优先样式

```css
/* styles.css - PDF 生成卡片 */

.mc-card-preview-modal {
  --safe-area-top: env(safe-area-inset-top, 0);
  --safe-area-bottom: env(safe-area-inset-bottom, 0);
  max-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.mc-card-preview-modal .modal-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 16px;
  padding-top: max(16px, var(--safe-area-top));
  padding-bottom: max(100px, calc(16px + var(--safe-area-bottom)));
}

.mc-preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--divider-color);
}

.mc-preview-header input[type='checkbox'] {
  min-width: 44px;
  min-height: 44px;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  border: 2px solid var(--text-muted);
  border-radius: 4px;
  background: transparent;
}

.mc-preview-header input[type='checkbox']:checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.mc-preview-number {
  flex: 1;
  font-weight: 600;
  color: var(--text-normal);
}

.mc-preview-question {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  margin-bottom: 16px;
  word-break: break-word;
  color: var(--text-normal);
}

.mc-preview-answer,
.mc-preview-note {
  width: 100%;
  min-height: 80px;
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid var(--text-muted);
  border-radius: 4px;
  background: var(--surface-secondary);
  color: var(--text-normal);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
}

.mc-preview-answer:focus,
.mc-preview-note:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--surface-primary);
}

.mc-preview-note {
  opacity: 0.8;
}

.mc-preview-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  padding: 12px;
  padding-bottom: max(12px, var(--safe-area-bottom));
  background: var(--surface-primary);
  border-top: 1px solid var(--divider-color);
  z-index: 1000;
  touch-action: manipulation;
}

.mc-btn-primary,
.mc-btn-secondary {
  min-height: 44px;
  padding: 12px;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  touch-action: manipulation;
}

.mc-btn-primary {
  grid-column: 2 / 4;
  background: var(--color-primary);
  color: var(--text-on-accent);
}

.mc-btn-secondary {
  background: var(--surface-secondary);
  color: var(--text-normal);
  border: 1px solid var(--divider-color);
}

/* 平板/桌面 */
@media (min-width: 600px) {
  .mc-preview-actions {
    position: static;
    gap: 12px;
    grid-template-columns: repeat(4, 1fr);
    padding: 16px;
  }
  
  .mc-btn-primary {
    grid-column: auto;
  }
}
```

---

## 4. Phase 2: Claudian 可选集成（草稿）

### 4.1 集成点

```typescript
// src/ai/claudianBridge.ts
export class ClaudianBridge implements AIProvider {
  private claudianWindow: any;
  
  constructor() {
    // 检测 Claudian 插件是否加载
    this.claudianWindow = (window as any).claudian?.api;
  }
  
  isAvailable(): boolean {
    return !!this.claudianWindow;
  }
  
  async generate(prompt: string): Promise<string> {
    // 发送请求到 Claudian
    const response = await this.claudianWindow.sendMessage({
      type: 'generate-cards',
      prompt,
      vault: app.vault.getName(),
    });
    return response.text;
  }
}

// 工厂方法
export function createAIProvider(
  config: GenerationConfig,
  app: App
): AIProvider {
  if (config.aiProvider === 'claudian') {
    const bridge = new ClaudianBridge();
    if (!bridge.isAvailable()) {
      throw new Error(
        'Claudian 插件未安装或未加载。请安装 Claudian 或切换到内置 Claude 提供者。'
      );
    }
    return bridge;
  }
  
  if (config.aiProvider === 'claude') {
    return new ClaudeProvider(config.claudeApiKey!, config.claudeModel);
  }
  
  throw new Error(`Unknown AI provider: ${config.aiProvider}`);
}
```

### 4.2 消息协议（待与 Claudian 团队协商）

```typescript
// 建议的消息格式
interface MemoryCardsRequest {
  type: 'generate-cards';
  vault: string;
  prompt: string;
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

interface MemoryCardsResponse {
  success: boolean;
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  error?: string;
}
```

---

## 5. 风险 & 缓解方案

| 风险 | 影响 | 缓解方案 |
|------|------|---------|
| **PDF 提取失败（扫描件）** | 无法处理图像类 PDF | 提示用户使用外部 OCR（Google Lens、专业 OCR 工具）；提供手动输入降级方案 |
| **AI 生成质量低/成本高** | 用户体验差或费用昂贵 | 提供多档精度设置；允许用户调整 temperature/maxTokens；显示成本预估 |
| **Claude API Key 泄露** | 安全问题 | 不存储 Key 在 data.json；使用 Obsidian 原生加密存储；文档明确说明风险 |
| **Claudian 版本不兼容** | 集成断裂 | 运行时检测版本；提供降级方案；协商版本协议 |
| **移动端网络不稳定** | 生成中断 | 实现断点续传或本地缓存；显示重试按钮；允许离线预览编辑 |
| **生成卡片量太大（OOM）** | 崩溃 | 分批生成（如每次 100 张）；分页预览 |

---

## 6. Phase 1 MVP 实现拆分

### 6.1 依赖

```json
{
  "devDependencies": {
    "pdfjs-dist": "^4.x",
    "string-similarity": "^4.x"
  }
}
```

### 6.2 文件和测试清单

| 文件 | 优先级 | 测试覆盖 |
|------|--------|---------|
| src/pdf/pdfExtractor.ts | P0 | 单元测试：正常 PDF、扫描件、损坏 PDF |
| src/ai/aiProvider.ts | P0 | 抽象接口验证 |
| src/ai/claudeProvider.ts | P0 | 单元测试：Key 验证、API 调用模拟 |
| src/cardGeneration/cardGenerator.ts | P0 | 单元测试：prompt 生成、JSON 解析 |
| src/cardGeneration/cardDeduplicator.ts | P1 | 单元测试：相似度计算、去重逻辑 |
| src/ui/pdfPickerModal.ts | P1 | 集成测试：文件选择、移动触控 |
| src/ui/cardPreviewModal.ts | P1 | 集成测试：预览、编辑、导入流程 |
| src/ui/aiConfigPanel.ts | P2 | 集成测试：Key 输入、模型选择 |
| src/store.ts (扩展) | P0 | 单元测试：aiConfig 持久化 |

### 6.3 实现步骤

```
Week 1:
  □ PDF 提取器 + 单元测试 (pdfExtractor.ts)
  □ AI provider 接口定义 + Claude 实现 (aiProvider.ts, claudeProvider.ts)
  □ 卡片生成逻辑 + 提示词设计 (cardGenerator.ts)
  
Week 2:
  □ 去重逻辑 + 相似度计算 (cardDeduplicator.ts)
  □ CardPreviewModal UI (移动优先)
  □ 集成测试：完整流程
  
Week 3:
  □ 设置面板 (aiConfigPanel.ts)
  □ 错误处理 & 回滚机制
  □ 移动端真机测试 (iOS/Android)
  
Week 4:
  □ 性能优化（大文件、批处理）
  □ 文档 & 用户教程
  □ v0.2 发布准备
```

---

## 7. Phase 2 (v0.3) 与 Claudian 协商方案

### 步骤
1. **调研 Claudian 当前 API**: 咨询 YishenTu（Claudian 作者）是否已有插件间通信机制
2. **起草消息协议**: 基于 Obsidian 事件总线或 window 对象约定消息格式
3. **协议版本管理**: 定义向后兼容性保证（semver）
4. **官方文档**: 发布 Claudian 集成指南到 obsidian-releases

### Claudian 联系信息
- **GitHub**: https://github.com/YishenTu/claudian
- **邮件**: 通过 GitHub issues 沟通

---

## 8. 数据安全与隐私

### 承诺
- **本地优先**: PDF 提取、去重、编辑都在本地完成，不上传到云
- **API Key 加密**: Claude API Key 使用 Obsidian 原生存储，不明文写入
- **用户控制**: 生成前预览，显示将发送的内容
- **可审计**: 生成日志记录（可选），便于用户审查

### 实现
```typescript
// src/store.ts
async saveAIConfig(config: GenerationConfig): Promise<void> {
  // 仅存储 Key 的 hash，验证时需用户重新输入或使用 Obsidian 加密
  const encrypted = await this.app.vault.adapter.encrypt?.(config.claudeApiKey);
  await this.saveData({ aiConfig: { ...config, claudeApiKey: encrypted } });
}
```

---

## 9. 长期愿景（Phase 3+）

### 9.1 多 AI Provider 支持
- OpenAI GPT-4
- 本地 Ollama / LLaMA
- Google Gemini
- 开源模型（via Hugging Face API）

### 9.2 高级功能
- 多语言卡片生成（中文、英文、日文等）
- 图表提取（表格 → 卡片）
- 视频 + 字幕 → 卡片
- 协作编辑（多用户去重）

### 9.3 生态建设
- 发布 Memory Cards AI Provider SDK
- 允许第三方编写 provider 插件
- 定义 Obsidian 插件间通信标准

---

## 10. 结论

**推荐立即启动 Phase 1（内置 Claude API）**：
- ✅ 快速上线，用户无需安装额外依赖
- ✅ 完整体验：PDF 提取 → AI 生成 → 预览编辑 → 批量导入
- ✅ 为 Phase 2 Claudian 集成奠定基础
- ✅ 4 周内可交付 v0.2 MVP

**关键成功要素**：
1. 移动端 UI 设计要充分测试（>= 44px 触控目标、无 keyboard 依赖、safe area）
2. AI 生成质量通过迭代调整 prompt 提升
3. 与用户社区沟通 API Key 安全政策
4. 预留与 Claudian 协商的时间窗口（Phase 2）
