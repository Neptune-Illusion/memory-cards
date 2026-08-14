# Baseline CSS 与移动遮挡风险复审报告

**任务**: #019ffbf2-0ae0-7923-9a3c-1158a6208ec2
**审查对象**: `styles.css`, UI DOM classes（reviewModal / quickAddModal / statsModal / confirmDialog）, `tests/css-contract.test.ts`, `BASELINE_STYLE_AUDIT.md`
**状态**: ✅ 115 tests pass, build clean（审查后修复并补充测试）
**时间**: 2026-08-14

---

## 一、严重性总览

| 严重性 | 问题 | 状态 |
|---|---|---|
| **高** | 评分栏在长答案时低于折叠线，拇指不可达 | ✅ 已修复 |
| **高** | 横屏 grade 触控目标缩至 36px（<44px） | ✅ 已修复 |
| **中** | 长代码块/表格/图片横向溢出，撑破卡片 | ✅ 已修复 |
| **中** | 无顶部 padding，Obsidian close-button 遮挡 header | ✅ 已修复 |
| 低 | safe-area 重复 padding（需确认） | ⚠️ 保留，附说明 |
| 低 | 注释中的 `position:fixed` 触发静态测试误判 | ✅ 无此问题（测试已剥离注释） |

---

## 二、逐项审查

### 1. 选择器是否匹配 Obsidian Modal DOM — ✅ 正确
- `ReviewModal`/`StatsModal`/`QuickAddModal`/`ConfirmDialog` 均在 `this.modalEl.addClass('memory-cards-modal')` 上添加插件类。
- Obsidian Modal 结构：`modalEl`（`.modal`）→ `contentEl`（`.modal-content`）。
- 插件选择器 `.memory-cards-modal .modal-content`、`.memory-cards-modal .mc-*` 全部落在 `.modal` 作用域内，**不会泄漏到全局**。✓
- 唯一的类外引用 `modal.titleEl`（ConfirmDialog）不受插件 CSS 影响。✓

### 2. 对 `.modal-content` 的覆盖是否过宽 — ✅ 可接受
- 仅 `.memory-cards-modal .modal-content` 二级选择器覆盖，限制在本 modal 内。
- `overflow-y:auto`、`flex:1 1 0%`、`min-height:0` 为滚动必需，未覆盖全局 `.modal-content`。✓

### 3. safe-area 是否重复 padding — ⚠️ 低风险，保留
- 依据：`BASELINE_STYLE_AUDIT.md §4` 指出 Obsidian 1.7.2+ 的 `Modal` 基类已自动处理 safe-area-inset。
- 插件在 `.memory-cards-modal` 上四边加了 `env(safe-area-inset-*)` padding（styles.css:20-23）。
- **潜在重复**：若宿主 Obsidian ≥1.7.2，模态框已含 safe-area 底边距，插件再加一次可能产生双重 padding。
- **决定：保留**。`manifest.json` 的 `minAppVersion` 为 **1.5.0**（<1.7.2），为兼容 1.5.0~1.7.1 用户，插件的 safe-area 是必要兜底。已加注释说明。若未来将 minAppVersion 提升至 ≥1.7.2，应移除插件侧 safe-area 以避免双重 padding。

### 4. modal-close-button 遮挡 — 🔴 高，已修复
- **问题**：Obsidian Modal 的 `.modal-close-button` 为绝对定位、位于 modal 右上角。`.mc-header`（含进度条/进度数字）原为 `padding: 0 0 var(--mc-gap)`，顶部右上角无避让，close 按钮可能覆盖进度文本。
- **修复**：`.mc-header` padding 改为 `var(--mc-gap) 40px var(--mc-gap) 0`，右上角预留 40px 给 close 按钮（styles.css:49）。

### 5. 320x568 / 横屏低高度 — 🔴 高，已修复
- **问题**：横屏 `@media (max-height:500px) and (orientation:landscape)` 内 `.mc-grade { min-height: 36px }`，违反 44px 触控目标下限（SPEC §3.5.2）。
- **修复**：横屏 grade `min-height` 提升至 44px，并保持 4 列布局（styles.css:388-395）。

### 6. 长问题/答案/代码块/table/image — 🔴 高，已修复
- **问题**：`.mc-question`/`.mc-answer` 仅 `word-break:break-word`，对宽 `pre`（代码块）、`table`、`img` 无效——这些元素可横向撑破卡片，或超出 `overflow-y:auto` 容器的可视宽度。
- **修复**（styles.css:46-58）：
  - `.modal-content pre` / `table`：`max-width:100%; overflow-x:auto`，`table` 用 `display:block` 启用横向滚动。
  - `.modal-content img`：`max-width:100%; height:auto`。

### 7. QuickAdd 键盘 — ✅ 已有处理，轻微改进空间
- `scrollFieldIntoView` 用 `visualViewport` + `scrollIntoView({block:'center'})`，输入框在键盘弹出后可自动上移到可视区。✓
- `adjustTextareaHeights` 限制 textarea ≤ 40% 视口高。✓
- **轻微改进（未改）**：`scrollFieldIntoView` 固定 100ms 延迟，个别设备键盘动画时长不同可能偏差；可改为监听 `visualViewport.resize` 后滚动。当前已够用，列为后续优化。

### 8. 评分操作区是否可达 — 🔴 高，已修复
- **问题**：评分栏 `.mc-grades` 原为普通流内元素，置于滚动容器 `.modal-content` 末尾。长答案时评分按钮在折叠线下方，拇指需长滚才可评分，违背 SPEC §3.5.1"评分栏固定为底部粘性栏"与 §3.5.5"评分栏保持粘性"。
- **修复**（styles.css:142-154）：`.mc-grades` 改为 `position: sticky; bottom: 0; z-index:1`，附 `background: var(--background-primary)` + 顶部边框，滚动时评分栏吸附在可视区底部，拇指始终可达。

### 9. Baseline light/dark 变量兼容 — ✅ 通过
- 全部颜色使用语义变量（`--background-primary`、`--background-secondary`、`--background-modifier-border`、`--text-*`、`--interactive-accent`），Baseline light/dark 均定义这些变量。✓
- 唯一 fallback `rgba(0,0,0,0.05)` 仅在变量未定义时兜底，符合规范。✓

### 10. CSS 注释是否让静态测试误判 `position:fixed` — ✅ 无此问题
- `css-contract.test.ts:46-51` 检查前先 `css.replace(/\/\*[\s\S]*?\*\//g, '')` 剥离注释。
- `styles.css` 顶部与 `.modal` 附近的注释确实提到 `position: fixed`（如第 3 行 "No position:fixed"），**但剥离后不会命中检测**。✓
- 插件 CSS 实际无 `position: fixed` 规则。✓

---

## 三、本次修复与测试变更

### styles.css 改动
1. `.mc-header`：右上角预留 40px 避让 close 按钮（高严重性遮挡）。
2. `.mc-grades`：`position:sticky; bottom:0`，长答案时评分栏保持拇指可达（高严重性）。
3. 横屏 `.mc-grade`：min-height 36px→44px（高严重性触控）。
4. `.modal-content`：新增 `pre`/`table`/`img` 横向溢出遏制（高严重性溢出）。

### tests/css-contract.test.ts 新增 4 项
- grade bar sticky bottom 可达性
- header close-button 避让
- 横屏 grade ≥44px 触控目标
- 长内容（pre/table/img）contained + 横向滚动

### 验证
- `npm test` → **115/115 pass**（原 111 + 新增 4）
- `npm run build` → clean

---

## 四、遗留风险 / 建议
- **safe-area 重复 padding**：若 minAppVersion 升至 ≥1.7.2 建议移除插件侧 safe-area（见 §3）。
- **QuickAdd 滚动延迟**：100ms 固定延迟可改为 visualViewport.resize 驱动（低优先级）。
- **横屏 4 列评分**：44px×4 在超窄横屏（如 320px 宽）可能偏挤；已保持 44px 触控下限优先，后续可评估横屏改为 2 行。

---

*OpenCode · Baseline CSS 复审 · 2026-08-14*
