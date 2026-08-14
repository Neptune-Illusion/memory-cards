# PDF AI 自动制卡 Phase 1 MVP — 实现报告

**时间**: 2026-08-15
**版本**: 0.1.2 → 0.2.0
**状态**: ✅ 193 tests pass, build clean

## 新增文件

| 文件 | 说明 |
|------|------|
| `src/ai/aiProvider.ts` | AIProvider 接口 + AIProviderConfig 类型 |
| `src/ai/claudeProvider.ts` | Claude API 实现（fetch + timeout/cancel/retry） |
| `src/pdf/pdfExtractor.ts` | PDF 文本提取（pdfjs-dist lazy-load，扫描件返回 null） |
| `src/cardGeneration/cardGenerator.ts` | Prompt 构建 + JSON 解析（容错提取） |
| `src/cardGeneration/cardDeduplicator.ts` | 去重逻辑（字符重叠相似度，阈值 0.7） |
| `src/ui/pdfPickerModal.ts` | PDF 文件选择器（移动优先，≥44px 触控） |
| `src/ui/cardPreviewModal.ts` | 卡片预览/编辑/选中/导入（MarkdownRenderer 渲染） |
| `src/ui/aiConfigPanel.ts` | AI 设置面板（API Key、模型、endpoint、temperature） |
| `tests/pdfAutoCard.test.ts` | 12 项行为测试（prompt/解析/去重/provider mock） |

## 修改文件

| 文件 | 变更 |
|------|------|
| `src/types.ts` | PluginData 扩展 aiConfig 字段 |
| `src/store.ts` | 新增 aiConfig getter/setter + DEFAULT_AI_CONFIG 导入 |
| `src/main.ts` | 新增「从 PDF 生成卡片」命令 + generateCardsFromPDF 工作流 + getAIConfig/saveAIConfig |
| `styles.css` | PDF 列表、卡片预览、编辑区、操作栏样式 |
| `tsconfig.json` | 排除 prototype 文件 |
| `manifest.json` / `package.json` / `versions.json` | → 0.2.0 |
| `CHANGELOG.md` / `README.md` | v0.2.0 条目 + 测试数更新 |

## 核心工作流

```
命令「从 PDF 生成卡片」
  → 检查 API Key → PDFPickerModal 选择 .pdf
  → PDFExtractor.extract()（pdfjs-dist，空文本返回 null + 降级提示）
  → ClaudeProvider.generate()（timeout 60s, cancel, retry 2）
  → parseGeneratedCards()（JSON 容错提取）
  → deduplicateCards()（相似度阈值 0.7）
  → CardPreviewModal（逐卡编辑/选中/全选切换）
  → 逐卡写入 vault（renderCardMarkdown → 文件创建 → 索引更新）
```

## 依赖

新增 `pdfjs-dist@4.9.155`（lazy-load，不阻塞初始 bundle）。

## AI 安全

- API Key 存储在 `data.json`（Obsidian 原生持久化），不明文写日志
- 请求使用 AbortController 支持取消
- 超时 60s 自动中断
- 失败重试最多 2 次（递增退避）

## 测试覆盖

- `pdfAutoCard.test.ts`: 12 tests（prompt 构建、JSON 解析容错、去重逻辑、Claude provider mock fetch/retry）
- 全量: 13 files, 193 tests pass
- build: tsc + esbuild production clean

## 未推送

按任务要求未推送 GitHub、未建 Release。
