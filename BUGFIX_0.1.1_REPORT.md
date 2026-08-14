# Bugfix 0.1.1 Report

**时间**: 2026-08-14
**版本**: 0.1.0 → 0.1.1
**状态**: ✅ 141 tests pass, build clean

## 修复项

### 1. 桌面建卡弹窗 label/input 遮挡

**根因**: `.mc-field` 使用 `flex-direction: column` + `gap: 4px`，label 与 input 间距过小；label 无显式 margin-bottom，在窄窗口或缩放下 label 文字被 input 边框视觉覆盖。

**修复**:
- `styles.css`: `.mc-field` gap 4px → 8px，margin-bottom 10px → 14px
- `styles.css`: `.mc-field label` 增加 `margin-bottom: 2px; line-height: 1.4`

### 2. 移动端无新建卡片入口

**根因**: 仅有一个 ribbon icon（`brain-circuit` → 开始复习），QuickAdd 仅注册为 command，移动端无物理键盘无法通过 command palette 打开。

**修复**:
- `src/main.ts`: 新增 `this.addRibbonIcon('plus', '新建记忆卡', () => this.quickAdd())`
- 移动端 ribbon 栏显示 `+` 图标，点击直接打开 QuickAdd modal

### 3. LaTeX 渲染不支持长公式滚动

**根因**: `MarkdownRenderer.render()` 已正确调用（含 `this.owner` Component 生命周期），但 CSS 未为 MathJax/KaTeX 输出容器设置 overflow 处理，长公式溢出 modal 遮挡评分栏。

**修复**:
- `styles.css`: 添加 `.math`, `.mathjax-block`, `mjx-container` 样式
- `overflow-x: auto` + `max-width: 100%` 支持横向滚动
- `mjx-container[display="true"]` 设置 `display: block` + margin

## 版本同步

| 文件 | 旧版本 | 新版本 |
|------|--------|--------|
| manifest.json | 0.1.0 | 0.1.1 |
| package.json | 0.1.0 | 0.1.1 |
| package-lock.json | 0.1.0 | 0.1.1 |
| versions.json | 0.1.0 → 1.5.0 | 0.1.1 → 1.5.0 |

## 测试结果

- `tests/bugfix-0.1.1.test.ts`: 12 tests (entry point, MarkdownRenderer lifecycle, CSS math contract, label spacing)
- 全量: **10 files, 141 tests passed**
- `npm run build`: 通过 (tsc + esbuild production)

## 文件变更

| 文件 | 操作 |
|------|------|
| `styles.css` | 增加 math/LaTeX overflow 样式；修改 mc-field gap/label spacing |
| `src/main.ts` | 新增 addRibbonIcon('plus') |
| `tests/bugfix-0.1.1.test.ts` | 新增 (12 tests) |
| `manifest.json` | version → 0.1.1 |
| `package.json` | version → 0.1.1 |
| `package-lock.json` | version → 0.1.1 |
| `versions.json` | 0.1.1 → 1.5.0 |
| `CHANGELOG.md` | 新增 v0.1.1 条目 |
| `README.md` | 版本号、测试数更新 |

## 未推送

按任务要求未推送 GitHub、未建 tag/release。用户可后续提交 commit 并推送。
