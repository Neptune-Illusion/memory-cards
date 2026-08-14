# Baseline 主题视觉契约提取报告

**主题**: Baseline v3.2.12 by Alexis C  
**仓库**: https://github.com/aaaaalexis/obsidian-baseline  
**许可证**: MIT  
**Stars**: 1,481 | **minAppVersion**: 1.13.4  
**审计时间**: 2026-08-13

---

## 1. 核心 CSS 自定义属性（插件必须使用）

### 颜色系统

| 变量 | 用途 | 示例值 (dark) |
|------|------|---------------|
| `--background-primary` | 主背景 | `var(--neutral-10)` |
| `--background-primary-alt` | 主背景变体 | `var(--neutral-17)` |
| `--background-secondary` | 次级背景/表面 | `var(--neutral-17)` |
| `--background-secondary-alt` | 次级背景变体 | `var(--neutral-20)` |
| `--background-modifier-border` | 边框 | `var(--neutral-variant-30)` |
| `--background-modifier-border-hover` | 悬停边框 | `var(--neutral-variant-40)` |
| `--background-modifier-border-focus` | 聚焦边框 | `var(--neutral-variant-60)` |
| `--background-modifier-form-field` | 输入框背景 | `var(--neutral-22)` |
| `--text-normal` | 主文字 | `var(--color-base-100)` |
| `--text-muted` | 次要文字 | `var(--neutral-60)` |
| `--text-faint` | 弱化文字 | `var(--neutral-40)` |
| `--text-on-accent` | 强调色上文字 | `var(--tertiary-20)` |
| `--interactive-normal` | 交互元素背景 | `var(--background-primary)` |
| `--interactive-hover` | 交互元素悬停 | `var(--background-secondary)` |
| `--interactive-accent` | 强调交互色 | `var(--tertiary-60)` |
| `--interactive-accent-hover` | 强调交互悬停 | `oklch(from var(--tertiary-80) calc(l + 0.05) c h)` |
| `--tag-background` | 标签背景 | `var(--secondary-20)` |
| `--tag-color` | 标签文字 | `var(--secondary-80)` |

### 排版

| 变量 | 值 |
|------|-----|
| `--font-interface-theme` | `Inter` |
| `--font-text-theme` | `Inter` |
| `--font-ui-smaller` | `calc(12px + var(--font-ui-modifier))` |
| `--font-ui-small` | `calc(13px + var(--font-ui-modifier))` |
| `--font-ui-medium` | `calc(15px + var(--font-ui-modifier))` |
| `--font-ui-large` | `calc(20px + var(--font-ui-modifier))` |

### 圆角与形状

| 变量 | 值 | 说明 |
|------|-----|------|
| `--corner-shape` | `superellipse(1.1)` | Baseline 特有的超椭圆圆角 |
| `--modal-radius` | 由 Obsidian 提供 | 模态框圆角 |
| `--button-radius` | 由 Obsidian 提供 | 按钮圆角 |
| `--input-radius` | 由 Obsidian 提供 | 输入框圆角 |
| `--setting-items-radius` | 由 Obsidian 提供 | 设置项圆角 |

### 阴影

| 变量 | 值 |
|------|-----|
| `--shadow-s` | `rgba(0,0,0,0.08) 0px 12px 24px -4px, rgba(0,0,0,0.04) 0px 8px 16px -4px` |
| `--shadow-l` | `0 14px 62px #00000040` |
| `--shadow-tactile` | `rgba(0,0,0,0.04) 0px 2px 8px -2px, rgba(var(--mono-rgb-100),0.04) 0px 2px 4px -2px` |

### 动画

| 变量 | 值 |
|------|-----|
| `--anim-speed-modifier` | `1` |
| `--anim-duration-superfast` | `calc(80ms * var(--anim-speed-modifier))` |
| `--anim-duration-fast` | `calc(160ms * var(--anim-speed-modifier))` |
| `--anim-duration-moderate` | `calc(320ms * var(--anim-speed-modifier))` |
| `--anim-duration-slow` | `calc(480ms * var(--anim-speed-modifier))` |
| `--anim-motion-baseline` | `cubic-bezier(0.1, 0, 0.1, 1.25)` |

---

## 2. 按钮 / 输入 / 模态框组件契约

### 按钮

Baseline 使用 Obsidian 原生 `.mod-cta` 类作为主按钮样式。插件应：
- 主按钮: `.mod-cta` class
- 次按钮: 默认 `<button>` 样式
- 按钮间距: 使用 `gap: 8px` 在 flex 容器中

### 输入框

Baseline 覆盖了 `.setting-item-control` 中的输入框样式：
- 背景: `var(--background-modifier-form-field)`
- 边框: `var(--border-width) solid var(--background-modifier-border)`
- 聚焦边框: `var(--background-modifier-border-focus)`
- 内边距: `var(--input-padding)`
- 字体: `var(--font-ui-small)`
- 圆角: `var(--input-radius)`

### 模态框

Baseline 覆盖了模态框样式：
- 背景: `var(--modal-background)`（Baseline 在不支持 `interpolate-size` 时强制设为 `var(--background-secondary)`）
- 圆角: `var(--modal-radius)`
- 阴影: `var(--shadow-l)`
- 标题: `var(--font-ui-large)` + `var(--h1-font)`

---

## 3. 移动端 Class 与规则

### 平台检测 Class

Baseline 使用 Obsidian 的标准平台 class：
- `body.is-mobile` — 移动端
- `body:not(.is-mobile)` — 桌面端
- `body.is-phone` — 手机（小屏）
- `body.is-tablet` — 平板

### 移动端特定规则

```css
/* Baseline 在桌面端设置图标大小，移动端不设置 */
body:not(.is-mobile) {
  --icon-xs: calc(14px + var(--icon-size-modifier));
  --icon-s: calc(16px + var(--icon-size-modifier));
  --icon-m: calc(16px + var(--icon-size-modifier));
  --icon-l: calc(16px + var(--icon-size-modifier));
  --icon-xl: calc(32px + var(--icon-size-modifier));
}

/* 桌面端 app 容器居中 + 过渡动画 */
body:not(.is-mobile) .app-container {
  transition: var(--anim-duration-moderate);
  align-items: center;
}

/* 桌面端工作区背景 */
body:not(.is-mobile):not(.is-translucent) .workspace {
  background: var(--background-secondary);
}
```

### 移动端导航栏（Material 主题）

```css
/* Material Light 手机 */
.theme-light.material-light:where(.input-material).is-phone .mobile-navbar {
  background-color: var(--secondary-95) !important;
}
.theme-light.material-light:where(.input-material).is-phone .mobile-navbar-action {
  --icon-color: var(--secondary-30);
}

/* Material Dark 手机 */
.theme-dark.material-dark:where(.input-material).is-phone .mobile-navbar {
  background-color: var(--secondary-20) !important;
}
.theme-dark.material-dark:where(.input-material).is-phone .mobile-navbar-action {
  --icon-color: var(--secondary-80);
}
```

### 减少动画

```css
body.reduce-motion {
  --anim-speed-modifier: 0 !important;
}
body.reduce-motion.is-mobile .mobile-tab-switcher,
body.reduce-motion.is-mobile .menu,
body.reduce-motion.is-mobile .suggestion-bg,
body.reduce-motion.is-mobile .modal,
body.reduce-motion.is-mobile .modal-bg {
  transition: none !important;
}
```

---

## 4. Safe Area 处理

Baseline 本身**未显式设置** `env(safe-area-inset-*)`。但 Obsidian 1.7.2+ 的 `Modal` 基类已自动处理 safe-area-inset。插件使用 `Modal` 类时自动获得 safe-area 适配。

**插件建议**: 在 `.memory-cards-modal` 底部添加 `padding-bottom: env(safe-area-inset-bottom, 0px)` 作为保险。

---

## 5. 插件 CSS 应遵循的规则

### 必须使用 Obsidian 变量，不要硬编码

| ❌ 不要 | ✅ 要用 |
|---------|---------|
| `color: #fff` | `color: var(--text-normal)` |
| `background: #1e1e1e` | `background: var(--background-secondary)` |
| `border: 1px solid #333` | `border: var(--border-width) solid var(--background-modifier-border)` |
| `border-radius: 8px` | `border-radius: var(--modal-radius)` 或 `var(--button-radius)` |
| `font-size: 14px` | `font-size: var(--font-ui-small)` |
| `box-shadow: 0 4px 12px rgba(0,0,0,0.1)` | `box-shadow: var(--shadow-s)` |
| `transition: 0.2s ease` | `transition: var(--anim-duration-fast)` |

### 插件样式最佳实践

1. **所有颜色用变量**: 确保 light/dark 主题自动适配
2. **所有间距用变量**: `--spacing-*` 或 `var(--size-4-1)` 等
3. **圆角用变量**: `var(--button-radius)`, `var(--input-radius)`, `var(--modal-radius)`
4. **动画用变量**: `var(--anim-duration-fast)`, `var(--anim-duration-moderate)`
5. **不要覆盖全局样式**: 只在 `.memory-cards-modal` 作用域内定义样式

---

## 6. 许可证约束

- **Baseline**: MIT 许可证 — 可自由使用、修改、分发
- **无署名要求**: MIT 不要求在插件中声明 Baseline 依赖
- **建议**: 在 README 中感谢 Baseline 主题作为视觉参考

---

## 7. 参考来源

- 仓库: https://github.com/aaaaalexis/obsidian-baseline
- LICENSE: https://github.com/aaaaalexis/obsidian-baseline/blob/main/LICENSE.txt
- README: https://github.com/aaaaalexis/obsidian-baseline/blob/main/README.md
- 主题 CSS: https://github.com/aaaaalexis/obsidian-baseline/blob/main/theme.css (3,172 行, 570KB)
- manifest.json: version 3.2.12, minAppVersion 1.13.4
