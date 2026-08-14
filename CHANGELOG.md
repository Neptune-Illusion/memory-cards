# Obsidian 闪卡插件 — 变更日志

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
