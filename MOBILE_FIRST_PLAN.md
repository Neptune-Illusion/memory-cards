# Obsidian 闪卡插件 — Mobile-First 升级方案

## 目标
在现有 v0.1 基础上实现**移动端优先** (Obsidian Mobile 1.4+)：
- 触摸友好的复习 UI（大按钮、手势）
- 响应式布局（手机 / 平板 / 桌面）
- 离线复习（本地 data.json）
- 移动端特性（长按菜单、滑动快捷键）

## 实现分层

### 第 1 层：核心逻辑（已有，无需改）
- parser.ts / scheduler.ts / anticheat.ts / stats.ts / store.ts
- 单测通过，API 稳定

### 第 2 层：移动端 UI 改造
1. `src/ui/reviewModal.ts` — 响应式升级
   - 按钮最小高度 52px（拇指可及）
   - 简化问题排版（字体缩放、行高调整）
   - 竖屏：问题占 40% + 揭晓占 40% + 按钮占 20%
   - 横屏：问题占 50% + 揭晓/按钮占 50%

2. `src/ui/quickAddModal.ts` — 移动端表单
   - 字段堆栈（竖屏友好）
   - 输入框自动放大字体（避免浏览器缩放）

3. `src/ui/settingsTab.ts` — 列表友好
   - Toggle 开关（易于点击）
   - 数字输入自适应

4. `styles.css` — 响应式系统
   - 断点：`@media (max-width: 600px)` 手机，`(max-width: 1024px)` 平板
   - 触摸友好的 padding / margin
   - 字体大小阶梯（手机上扩大 1.1x）

### 第 3 层：移动端增强（可选）
- 长按卡片菜单（编辑、删除、标记）
- 滑动手势快捷评分（左滑 = Again，右滑 = Easy）
- 深色模式自适应（跟随系统）
- 横屏锁定选项

## 验收标准

| 项 | 标准 |
|---|---|
| 按钮尺寸 | 最小 48×48px，推荐 52×52px |
| 文本可读性 | 手机上字体 ≥16px（避免自动缩放） |
| 触摸间距 | 按钮间距 ≥8px |
| 竖屏响应 | 全流程在 320×568 (iPhone SE) 无滚动 |
| 离线可用 | data.json 本地存，无网络依赖 |
| 性能 | 单卡渲染 <100ms（手机上） |

## 实现顺序

1. **响应式样式升级** (`styles.css`)
2. **reviewModal 触摸优化** (`src/ui/reviewModal.ts`)
3. **quickAddModal 表单适配** (`src/ui/quickAddModal.ts`)
4. **设置页按钮优化** (`src/ui/settingsTab.ts`)
5. **手势交互**（可选）
6. **测试** — 实际移动设备或 Chrome DevTools 手机模式

---

**开始时间**: 2026-08-13 23:15  
**预计耗时**: 2-3 小时（响应式 + 手势）
