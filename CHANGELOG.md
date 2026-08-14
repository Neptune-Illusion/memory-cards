# Obsidian 闪卡插件 — 变更日志

## v0.3.0 补丁 — 拆卡密度、硬上限与旧 endpoint 迁移（2026-08-15）

### 🔧 修复
- **generationDensity**: 独立配置项（低/标准/高），不再借用 newPerDay
- **maxCards**: 总卡数硬上限（1-500，默认100），合并去重后截断
- **旧配置迁移**: provider 'claude' → 'anthropic'，endpoint → baseUrl（保留代理配置）
- **配置归一化**: 空/非法值自动修正，maxCards 边界裁剪
- **设置 UI**: 新增密度下拉 + 最大卡片数输入

### ✅ 测试
- 新增 15 项行为测试: 配置迁移、密度值、截断、归一化
- 197 tests pass, build clean

---

## v0.3.0 — 多 AI Provider + PDF 原子知识点拆卡（2026-08-15）

### 🚀 新增
- **多 AI Provider**: 支持 Anthropic (Claude)、OpenAI-compatible（OpenAI/DeepSeek/OpenRouter/本地）、Google Gemini
- **Provider 统一接口**: generate/validate/timeout/cancel/retry 一致，密钥不进日志
- **PDF 原子知识点拆卡**: 分页/段落感知分块 + 重叠窗口，每块提取多个原子知识点
- **跨块去重**: 按规范化问题+答案对去重，避免跨块重复
- **结构化输出校验**: 数组和字段校验，单块失败可重试/跳过，最终失败摘要
- **配置 UI**: Provider 下拉选择、Base URL、Model、API Key，per-provider 合理默认值
- **进度通知**: 每个片段生成进度、失败摘要、部分成功处理
- **Token 预算**: 每块 3000 字符 + 500 重叠，避免大 PDF OOM

### ✅ 测试
- 新增 15 项行为测试: 分块逻辑、跨块去重、多 provider 请求格式、错误降级、多卡生成
- 182 tests pass, build clean

### 📦 版本
- manifest.json / package.json / versions.json → 0.3.0
- 新增: src/ai/openaiProvider.ts, src/ai/geminiProvider.ts, src/ai/providerFactory.ts
- 重命名: claudeProvider.ts → anthropicProvider.ts

---

## v0.2.0 — PDF AI 自动制卡（Phase 1 MVP）（2026-08-15）

### 🚀 新增
- **从 PDF 自动生成卡片**: 选择 vault 内 PDF → 提取文本 → AI 生成记忆卡片 → 预览编辑 → 批量导入
- **Claude API 内置 provider**: 支持配置 API Key、模型、endpoint、temperature、maxTokens
- **AI 配置面板**: 设置 → AI 自动制卡，密钥不明文日志
- **PDF 文本提取**: 使用 pdfjs-dist（lazy-load），扫描件/空文本给出明确降级提示
- **卡片预览/编辑**: 逐卡浏览、编辑答案/注解、选中/反选、全选切换
- **卡片去重**: 与已有卡片相似度检测（阈值 0.7），避免重复导入
- **AI 请求容错**: 超时（60s）、取消、重试（默认 2 次）、JSON 解析失败恢复
- **命令入口**: 命令面板「从 PDF 生成卡片」，桌面与移动可触控
- **LaTeX/Markdown 保留**: 生成卡片支持行内 $...$ 和块级 $$...$$ 公式

### ✅ 测试
- 新增 `tests/pdfAutoCard.test.ts`（12 tests）: prompt 构建、JSON 解析、去重逻辑、Claude provider mock
- 193 tests pass, build clean

### 📦 版本
- manifest.json / package.json / versions.json → 0.2.0
- 新增依赖: pdfjs-dist@4.9.155

---

## v0.1.2 — Bugfix: 移动端会话恢复弹窗按钮无响应（2026-08-14）

### 🐛 根因
- `ConfirmDialog` 点击处理先 `modal.close()` 再 resolve，移动端 DOM 拆除可能取消 iOS 合成 click → 按钮看似无响应
- 关闭路径（X / 遮罩 / Escape）不 resolve → `promptResumeSession()` 永久 pending，插件假死
- 双击 / close+onClose 并发存在双重 resolve 风险

### 🔧 修复
- 重写 `confirmDialog.ts`：决策状态 `ConfirmDecision` 与 UI 分离，settle-once 守卫
- 按钮先 settle 再 close；`onClose` 兜底 resolve `dismiss`，Promise 永不挂起
- `mapConfirmResult` 支持三态（continue/abandon/dismiss）
- `main.ts`：dismiss 时保留旧会话不静默继续；abandon 清除并新开复习
- CSS：`.mc-actions button` ≥44px + `touch-action: manipulation`（消除移动端双击缩放延迟）

### ✅ 测试
- 新增 `tests/session-resume.test.ts`（12 tests）：真实 click 事件分发、resolve-once、dismiss 路径、Store activeSession 变化、restored revealed
- 157 tests pass, build clean

---

## v0.1.1 — Bugfix: 建卡遮挡 / 移动入口 / LaTeX 渲染（2026-08-14）

### 🔧 修复
- **桌面建卡遮挡**: 增加 `.mc-field` label 与 input/textarea 间距（gap 4→8px, margin-bottom），消除 label 被输入框边框覆盖
- **移动端建卡入口**: 新增 ribbon icon (`+` 新建记忆卡)，无需键盘即可打开 QuickAdd；复习空队列摘要页新增"新建卡片"触控按钮（手机 ribbon 折叠时仍可达）
- **LaTeX 渲染**: 为 math/mjx-container 添加 `overflow-x: auto` + `max-width: 100%`，长公式横向滚动
- **渲染生命周期加固**: 问题/答案/注解改用每卡独立 `Component` 作为 MarkdownRenderer owner，卡切换与模态关闭时 `unload()`，避免在插件 owner 上累积 postprocessor（MathJax/KaTeX）子组件、防止旧异步结果在卡切换后写回

### ✅ 测试
- 新增 `tests/bugfix-0.1.1.test.ts`：入口点、MarkdownRenderer 每卡生命周期（非 owner 直传）、卡切换清理、CSS 数学公式契约、label 间距契约、summary 触控入口
- 145 tests pass, build clean
- 示例卡新增 `$...$` / `$$...$$` 公式；README 补充公式语法说明

### 📦 版本
- manifest.json / package.json / versions.json → 0.1.1

---

## v0.1.0 — Release-Ready（2026-08-14）

### 🔧 发布准备
- 插件 ID 从 obsidian-memory-cards 迁移到 memory-cards（社区规则合规）
- 添加 MIT LICENSE
- 添加 versions.json
- 完善 .gitignore
- 添加 GitHub Actions CI
- 添加发布就绪契约测试
- 更新文档与发布清单

### 🎯 新增
- **响应式设计** — 手机/平板/桌面三层断点，完整适配
- **手势快捷** — 左滑"模糊"、右滑"轻松"，40px+ 检测
- **键盘扩展** — `←` `→` 快速评分（左 = Hard，右 = Easy）
- **无障碍** — aria-label 全覆盖，Focus 反馈，字体防缩放

### 🔧 改进
- 按钮最小尺寸 52×52px（拇指可及）
- 输入框 `font-size: 1em` 防 iOS 自动缩放
- 触摸间距 ≥8px 全覆盖
- 竖屏堆栈，横屏展开

### ✅ 验证
- 129 个单元测试全过（9 个测试文件）
- 构建通过（tsc + esbuild）

### 📦 兼容性
- Obsidian Desktop 1.5.0+
- Obsidian Mobile 1.4.0+

---

## v0.1.0 — MVP 基础版本（2026-08-13）

### 🚀 核心功能
- 从文件夹递归读取卡片
- 手动创建卡片（Quick Add）
- 复习会话（问题→揭晓→4 档评分，2 次点击）
- SM-2 派生调度（新手期 1/3/6 天）
- 本地持久化（data.json）
- 统计仪表盘
- 防熟悉感偏差检测

### 📋 卡片格式
```markdown
---
memtype: card
tags: [生物, 期末]
---

问题：细胞呼吸三阶段？

??? 答案

糖酵解、柠檬酸循环、氧化磷酸化。

::: 注解

糖酵解在细胞质。
```

### 🧪 质量保证
- 50 个单测（parser / scheduler / anticheat / store）
- 纯函数架构，易于维护
- 离线复习，无网络依赖
