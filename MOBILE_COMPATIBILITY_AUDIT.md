# Obsidian Mobile 兼容性审计报告

**审计时间**: 2026-08-13  
**审计范围**: `src/`, `manifest.json`, `styles.css`  
**参考来源**: Obsidian 官方文档、obsidian.d.ts API、obsidian-spaced-repetition (578K 下载)、True Recall、Obsidian Forum

---

## 审计结论

插件 `manifest.json` 声明 `isDesktopOnly: false`，但代码中存在 **6 个高/中风险问题** 和 **4 个低风险问题**。核心问题是：键盘依赖、缺少 `Platform.isMobile` 分支、无 safe-area-inset 处理、以及大 vault 下的性能隐患。

**总体评估**: 插件可在移动端加载和基本运行，但用户体验存在明显缺陷，需要修复后才能达到生产质量。

---

## 高风险（P0）— 功能受损或不可用

### H1. 键盘快捷键在移动端无效

**位置**: `src/ui/reviewModal.ts:52-61`

```typescript
this.scope.register([], ' ', (event) => { ... });
for (const button of GRADE_BUTTONS) {
  this.scope.register([], button.key, (event) => { ... });
}
```

**问题**: 移动端没有物理键盘，空格键和 1-4 数字键快捷键完全不可用。当前代码已有按钮作为备选（第 95-97 行的 `revealButton` 和第 127-132 行的评分按钮），所以功能不会完全损坏，但：
- 提示文本 "先在脑海里回答，再揭晓（空格）" 在移动端会误导用户
- 按钮 hint 文本 `1 · 完全没想起` 等在移动端无意义

**修复方案**: 使用 `Platform.isMobile` 检测，移动端隐藏键盘提示、调整按钮布局。

**验证方法**: 在 iOS/Android Obsidian 中打开复习模态框，确认按钮可正常点击。

**来源**: 
- obsidian.d.ts: `Platform.isMobile: boolean`
- Obsidian Forum: "Android Hover Support" — 移动端 hover/键盘行为差异
- obsidian-spaced-repetition: 移动端使用触摸按钮而非键盘快捷键

---

### H2. 按钮聚焦行为在移动端异常

**位置**: `src/ui/reviewModal.ts:97, 133, 218`

```typescript
revealButton.focus();           // 第 97 行
(bar.firstElementChild as HTMLElement | null)?.focus();  // 第 133 行
close.focus();                  // 第 218 行
```

**问题**: 在移动端，`.focus()` 会触发虚拟键盘弹出（如果元素是可输入的），或产生不必要的滚动行为。对于按钮元素，聚焦效果不明显且可能引起意外的视口跳动。

**修复方案**: 移动端跳过 `.focus()` 调用，或使用 `requestAnimationFrame` 延迟执行。

**验证方法**: 在移动端打开复习模态框，确认不会触发键盘弹出或视口跳动。

**来源**: 
- Obsidian Forum: "Mobile toolbar and bottom navbar do not show up on keyboard activation"
- Obsidian Forum: "Android: no editor toolbar when physical keyboard is connected"

---

### H3. QuickAdd 模态框 textarea 在移动端的虚拟键盘适配

**位置**: `src/ui/quickAddModal.ts:53-61`

```typescript
private field(...): HTMLInputElement | HTMLTextAreaElement {
  const el = kind === 'input'
    ? wrapper.createEl('input', { type: 'text', placeholder })
    : wrapper.createEl('textarea', { placeholder });
  return el;
}
```

**问题**: 移动端弹出虚拟键盘时，模态框内容可能被键盘遮挡，导致输入区域不可见。Obsidian 的 `Modal` 类会自动处理部分 safe-area，但 textarea 的高度在键盘弹出后需要重新计算。

**修复方案**: 监听 `visualViewport` resize 事件，动态调整模态框内容区域高度。或使用 `env(--safe-area-inset-bottom)` CSS 变量。

**验证方法**: 在移动端打开"新建记忆卡"，点击 textarea，确认键盘弹出后输入区域仍可见。

**来源**: 
- Obsidian Changelog: "The app will have default safe-area-inset properties set so that your views properly account for offsets in the mobile device viewport"
- Obsidian Changelog: "Bare modals should respect safe-area-insets by default"

---

## 中风险（P1）— 体验缺陷

### M1. 无 safe-area-inset 处理

**位置**: `styles.css` — 全局缺失

**问题**: iPhone 的 Dynamic Island 和底部 Home Indicator 区域需要 `env(safe-area-inset-top)` 和 `env(safe-area-inset-bottom)` 适配。当前 CSS 没有任何 safe-area 处理。模态框底部按钮（如"关闭"）可能被 Home Indicator 遮挡。

**修复方案**: 在 `.memory-cards-modal` 上添加：
```css
padding-bottom: env(safe-area-inset-bottom, 0px);
```

**验证方法**: 在有刘海的 iPhone 上打开统计模态框，确认底部按钮不被遮挡。

**来源**: 
- Obsidian Changelog: "The app will have default safe-area-inset properties set"
- Obsidian Changelog: "Bare modals should respect safe-area-insets by default"

---

### M2. 响应式断点不足

**位置**: `styles.css:154-158`

```css
@media (max-width: 480px) {
  .memory-cards-modal .mc-grades {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

**问题**: 
- 只有一个断点（480px），没有处理平板（768px+）的布局
- 问题文本 `font-size: 1.35em` 在小屏手机上可能过大
- `.mc-reveal` 按钮 `min-width: 160px` 在窄屏上可能溢出

**修复方案**: 添加 tablet 断点，调整字体大小和按钮宽度。

**验证方法**: 在 iPhone SE (375px)、iPhone 15 (393px)、iPad (810px) 上分别检查布局。

**来源**: 
- obsidian-spaced-repetition: 使用多个断点适配不同屏幕尺寸
- True Recall: 使用 `max-width` 和 `min-width` 组合断点

---

### M3. 大 vault 下全量索引的性能问题

**位置**: `src/cardIndex.ts:37-43`

```typescript
async rebuild(): Promise<void> {
  this.byId.clear();
  this.byPath.clear();
  const files = this.vault.getMarkdownFiles().filter((file) => this.inScope(file.path));
  for (const file of files) {
    await this.indexFile(file);
  }
}
```

**问题**: 移动端 CPU/内存受限，大 vault（1000+ 笔记）的全量索引可能导致：
- 首次加载时间过长（5-10 秒）
- 内存峰值过高
- UI 冻结

**修复方案**: 
1. 分批索引（每批 50 个文件，使用 `setTimeout` 让出主线程）
2. 添加加载进度指示器
3. 考虑使用 `requestIdleCallback` 进行后台索引

**验证方法**: 在移动设备上创建 500+ 笔记的 vault，测量索引时间和内存使用。

**来源**: 
- obsidian-spaced-repetition: 使用增量索引而非全量重建
- Obsidian Forum: "Plugins can't access Nodejs packages" — 移动端性能限制

---

### M4. `store.ts` 的 debounce 在移动端可能丢失数据

**位置**: `src/store.ts:126-132`

```typescript
private scheduleSave(): void {
  if (this.saveTimer) clearTimeout(this.saveTimer);
  this.saveTimer = setTimeout(() => {
    this.saveTimer = null;
    this.pendingSave = this.persistence.saveData(this.data);
  }, 300);
}
```

**问题**: 移动端 App 可能被系统杀死（内存不足、用户切换 App），300ms debounce 窗口内的未保存数据会丢失。桌面端有 `onunload` 保证，但移动端的生命周期不可靠。

**修复方案**: 
1. 减少 debounce 时间（100ms）或在关键操作后立即保存
2. 使用 `visibilitychange` 事件在 App 进入后台时强制保存

**验证方法**: 在移动端复习几张卡片后强制杀死 App，重启后确认进度是否保留。

**来源**: 
- Obsidian Capacitor 适配器: 移动端使用 `CapacitorAdapter`，文件写入是异步的
- store.ts `flush()` 方法: 已在 `onunload` 中调用，但移动端 `onunload` 不可靠

---

## 低风险（P2）— 轻微问题

### L1. 无 `Platform` API 使用

**位置**: 整个代码库

**问题**: 代码中没有任何 `import { Platform } from 'obsidian'` 或 `Platform.isMobile` 检查。虽然当前功能不会崩溃，但无法根据平台做差异化处理。

**修复方案**: 在 `reviewModal.ts` 和 `quickAddModal.ts` 中导入 `Platform`，用于：
- 移动端隐藏键盘提示文本
- 调整按钮布局
- 跳过不必要的 `.focus()` 调用

**验证方法**: 检查代码中是否使用了 `Platform` API。

**来源**: 
- obsidian.d.ts: `Platform.isMobile`, `Platform.isPhone`, `Platform.isTablet`
- obsidian-spaced-repetition: 使用 `Platform.isMobile` 做移动端适配

---

### L2. 按钮触摸目标尺寸勉强达标

**位置**: `styles.css:82-91`

```css
.memory-cards-modal .mc-grade {
  min-height: 52px;
  padding: 8px 4px;
}
```

**问题**: Apple HIG 建议最小触摸目标 44×44pt，当前 `min-height: 52px` 达标，但 `padding: 8px 4px` 导致实际可点击区域可能偏小（尤其是横向 padding 仅 4px）。

**修复方案**: 增加横向 padding 到 `8px`，确保触摸目标 ≥ 44×44pt。

**验证方法**: 在移动端点击评分按钮，确认不会误触相邻按钮。

**来源**: 
- Apple Human Interface Guidelines: 最小触摸目标 44×44pt
- Material Design: 最小触摸目标 48×48dp

---

### L3. `QuickAdd` 的 `Mod+Enter` 快捷键在移动端无效

**位置**: `src/ui/quickAddModal.ts:39-42`

```typescript
this.scope.register(['Mod'], 'Enter', (event) => {
  event.preventDefault();
  void this.submit();
});
```

**问题**: 移动端没有 Cmd/Ctrl 键，`Mod+Enter` 快捷键不可用。但已有"创建"按钮作为备选，功能不受影响。

**修复方案**: 无需修复，按钮已覆盖。可考虑在移动端添加"完成"按钮到键盘工具栏（需 Obsidian 支持）。

**验证方法**: 在移动端打开新建卡片模态框，确认"创建"按钮可用。

**来源**: 无（已通过按钮覆盖）

---

### L4. `stats.ts` 中的 `Date` 构造在时区边界可能不一致

**位置**: `src/stats.ts:34`

```typescript
const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
```

**问题**: 使用本地时区构造日期，跨时区旅行时可能影响连续打卡计算。这不是移动端特有问题，但移动端用户更可能跨时区。

**修复方案**: 使用 UTC 或明确记录时区假设。

**验证方法**: 修改设备时区后检查连续打卡是否正确。

**来源**: 无（边缘情况）

---

## 无需修复（已正确处理）

### ✅ `isDesktopOnly: false`
`manifest.json` 正确声明支持移动端。

### ✅ 触摸友好的按钮设计
`.mc-reveal` 按钮 `min-height: 40px`，`.mc-grade` 按钮 `min-height: 52px`，基本满足触摸需求。

### ✅ 响应式网格
`.mc-grades` 使用 `grid-template-columns: repeat(4, 1fr)`，在 480px 以下切换为 2 列。

### ✅ `Modal` 类的自动适配
使用 Obsidian 的 `Modal` 基类，自动获得基本的移动端适配（safe-area、滚动等）。

### ✅ 无 Node.js/Electron API 依赖
代码中没有使用 `require('fs')`、`child_process` 等 Node.js API，也没有使用 Electron 特有 API。

### ✅ 无 hover 依赖
代码中没有使用 `:hover` CSS 伪类或 hover event listener，移动端不受影响。

### ✅ 文件操作使用 Obsidian Vault API
所有文件操作通过 `this.app.vault` 进行，自动适配移动端的 `CapacitorAdapter`。

### ✅ `onunload` 中的 `flush()`
`store.ts` 的 `flush()` 方法在 `onunload` 中调用，确保正常退出时保存数据。

---

## 修复优先级排序

| 优先级 | ID | 问题 | 修复复杂度 | 影响范围 |
|--------|-----|------|-----------|---------|
| P0 | H1 | 键盘快捷键无效 | 低 | 复习流程 |
| P0 | H2 | 按钮聚焦异常 | 低 | 复习流程 |
| P0 | H3 | textarea 键盘遮挡 | 中 | 新建卡片 |
| P1 | M1 | safe-area-inset 缺失 | 低 | 全局 |
| P1 | M2 | 响应式断点不足 | 低 | 全局布局 |
| P1 | M3 | 大 vault 索引性能 | 高 | 首次加载 |
| P1 | M4 | debounce 数据丢失 | 中 | 数据持久化 |
| P2 | L1 | 无 Platform API | 低 | 代码质量 |
| P2 | L2 | 触摸目标尺寸 | 低 | 评分按钮 |
| P2 | L3 | Mod+Enter 无效 | 无 | 已有按钮 |
| P2 | L4 | 时区边界 | 低 | 连续打卡 |

---

## 参考来源

1. **Obsidian 官方文档**: https://docs.obsidian.md/Plugins/Getting+started/Mobile+development
   - "The Node.js API, and the Electron API aren't available on mobile devices."
2. **Obsidian API (obsidian.d.ts)**: https://github.com/obsidianmd/obsidian-api
   - `Platform.isMobile`, `Platform.isPhone`, `Platform.isTablet`
   - `CapacitorAdapter` — 移动端文件适配器
3. **Obsidian Changelog**: https://obsidian.md/changelog
   - safe-area-inset 自动设置
   - 模态框自动适配 safe-area
4. **obsidian-spaced-repetition**: https://github.com/st3v3nmw/obsidian-spaced-repetition
   - `isDesktopOnly: false`，578K 下载，移动端完全支持
   - 使用 `Platform.isMobile` 做差异化处理
5. **True Recall**: https://github.com/pieralukasz/true-recall
   - `isDesktopOnly: true`，明确放弃移动端支持
6. **Obsidian Forum**: https://forum.obsidian.md
   - "Android Hover Support" — 移动端 hover 行为差异
   - "Mobile toolbar and bottom navbar" — 键盘弹出/收起问题
   - "File Explorer on Mobile: hover tooltip sticks" — hover 在移动端的异常行为
7. **Apple HIG**: 最小触摸目标 44×44pt
8. **Material Design**: 最小触摸目标 48×48dp
