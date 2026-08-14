# Memory Cards — Obsidian 闪卡插件（v0.1.0）

把笔记变成可主动回忆的卡片，用间隔重复安排复习。实现依据 `design/记忆学习方案-SPEC.md`。

**版本**: v0.1.1 | **状态**: Release-ready | **平台**: Desktop 1.5.0+ / Mobile 1.4.0+

## 已实现

### 核心功能
- 从指定文件夹递归读取卡片，支持一个笔记多张卡
- 手动创建卡片（新建记忆卡命令，写入卡片文件夹并立即进入索引）
- 复习会话：只显示问题 → 主动回忆 → 揭晓 → 4 档评分，单卡 2 次点击
- SM-2 派生调度器（新手期 1/3/6 天，难度系数 1.3–3.0）
- 进度持久化在 `data.json`，笔记文件是卡片内容的唯一事实源
- 统计：到期数、今日复习、连续打卡、成熟卡占比、数据质量指标
- 防熟悉感偏差：过快揭晓提示、高分+过快揭晓时间隔减半、滚动窗口评分分布提醒

### Mobile-First + Baseline 风格
- 📱 响应式设计：手机竖屏 / 平板横屏 / 桌面宽屏三层适配
- 🎨 Baseline 对齐：继承 Obsidian/Baseline 语义变量（颜色/圆角/阴影/动画），无硬编码色
- 📐 移动安全：`dvh` 视口高度、safe-area 四边 insets、`min-height:0` flex 收缩、内容独立滚动
- ✋ 手势快捷：左滑"模糊"(Hard) / 右滑"轻松"(Easy)，50px 阈值防误触
- ⌨️ 键盘扩展：`←` `→` 快速评分（桌面）；数字键 1-4 全平台支持
- 🎯 触摸优化：52×52px 按钮（WCAG 推荐）、8px 间距、深色模式自适应
- 🔌 会话恢复：复习中断后可继续，24h 自动过期
- ⚡ 性能优化：分批索引（大 vault 不卡）、后台自动保存
- ♿ 无障碍：aria-label 全覆盖、Focus 反馈、字体防自动缩放

## 卡片格式

```markdown
---
memtype: card
tags: [记忆卡, 生物]
---

问题：细胞呼吸的三个阶段分别是什么？

??? 答案

糖酵解、柠檬酸循环、氧化磷酸化。

::: 注解

糖酵解在细胞质，后两者在线粒体。
```

`???` 前是问题，后是答案；`:::` 后是可选注解（评分后展示）。一个笔记内用 `---` 分隔多张卡。分隔符可在设置里改。

问题、答案、注解都按 Obsidian Markdown 渲染，**支持 LaTeX 公式**：
- 行内公式 `$...$`：`问题：$E = mc^2$ 是什么？`
- 块级公式 `$$...$$`：
  ```
  ??? 答案

  $$\int_0^1 x^2\,dx = \frac{1}{3}$$
  ```
长公式在手机上可横向滚动，不会遮挡评分栏。示例见 `卡片/示例-细胞呼吸.md`。

## 命令

| 命令 | 说明 |
|---|---|
| 开始复习 | 构建今日队列并进入复习会话（左侧栏图标同效） |
| 新建记忆卡 | 填问题/答案/注解/标签，写入卡片文件夹 |
| 查看统计 | 打开统计面板 |
| 重建卡片索引 | 手动重扫卡片文件夹 |

## 移动端使用说明

### 快速开始（iOS / Android）

1. **安装**: Obsidian Mobile 1.4+ → 社区插件 → 搜索 "Memory Cards" 或手动放入 `.obsidian/plugins/memory-cards/`
2. **启用**: 设置 → 社区插件 → Memory Cards → 启用
3. **创建卡片**: 开始复习 → 新建记忆卡 → 填写问题/答案
4. **复习**: 开始复习 → 回忆答案 → 点按钮或滑动评分

### 评分方式

| 方式 | 桌面 | 移动端 |
|---|---|---|
| **键盘** | 1-4 数字键 / 空格 / ← → | 1-4 数字键 |
| **手势** | — | 左滑 = Hard (1)，右滑 = Easy (4) |
| **按钮** | 全部 | 全部 |

**提示**: 
- 桌面显示快捷键提示；移动端隐藏以节省空间
- 手势阈值 50px，防止误触竖向滚动

### 已验证功能 ✅

在 **Chrome DevTools 移动端模拟**、**代码审查** 和 **CSS 静态契约测试** 中确认：

- ✅ 竖屏布局（2×2 按钮网格，无水平滚动）
- ✅ 横屏布局（4 列按钮展开）
- ✅ 按钮尺寸 ≥44px，触摸间距 8px
- ✅ 字体防自动缩放（iOS 16px 阈值）
- ✅ 深色模式自适应
- ✅ 手势检测逻辑（50px 阈值）
- ✅ 会话保存/恢复机制
- ✅ Baseline 风格对齐（语义变量、thin border、restrained shadow/radius）
- ✅ 移动安全（dvh、safe-area、flex 收缩、overscroll-behavior）
- ✅ CSS 静态契约测试 22 项通过
- ✅ 145 个单元测试 100% 通过

### ⏳ 未在真机 Obsidian 中验证

以下功能需在实际 iOS/Android Obsidian 中测试：

- ⏳ **虚拟键盘交互**: visualViewport resize 是否可靠工作
- ⏳ **后台保存**: App 切换时 visibilitychange 是否保存进度
- ⏳ **手势体验**: 真实触摸屏上 50px 阈值是否合适
- ⏳ **会话恢复 UX**: 用户看到的恢复流程是否直观
- ⏳ **大 vault 性能**: 500+ 笔记索引时是否卡顿
- ⏳ **iPhone 刘海**: safe-area-inset 是否正确处理 Home Indicator

**建议**: 
1. 在 Obsidian Mobile 1.4+ 上安装此版本
2. 在真机上创建 500+ 笔记的 vault 进行性能测试
3. 通过以下渠道反馈：GitHub Issues / 社区论坛 / 本项目 Discussions

---

## 已知限制

### v0.2.1 当前限制
- ❌ 无 UI 卡片编辑界面（笔记文本编辑可用）
- ❌ 无图片遮挡（仅文字卡片）
- ❌ 无填空/多选题型
- ❌ 无导出/导入
- ❌ 真机 Obsidian 全面验证待完成（见上方"未验证"列表）

### 性能考虑
- 大 vault（1000+ 笔记）首次索引可能需要几秒（已优化分批处理）
- 建议定期备份 `data.json` 以防数据丢失

## 开发

```bash
npm install
npm test        # 145 个单测：parser / scheduler / anticheat / store / mobile / mobile-lifecycle / css-contract / release-contract / bugfix-0.1.1
npm run build   # tsc 类型检查 + esbuild 打包出 main.js
npm run dev     # watch 模式
```

在 Obsidian 中测试：把 `main.js`、`manifest.json`、`styles.css` 放进 `<vault>/.obsidian/plugins/memory-cards/`，重载并启用插件。

## 反馈与支持

遇到问题或有建议？

- **Bug 报告**: [GitHub Issues](https://github.com/Neptune-Illusion/memory-cards/issues)
- **功能请求**: [Discussions](https://github.com/Neptune-Illusion/memory-cards/discussions)
- **移动端验证**: 特别欢迎在真机 Obsidian 上测试并反馈（见"未验证"清单）
- **BRAT 安装测试**: Obsidian → 设置 → 社区插件 → BRAT → Add beta plugin → 输入 `Neptune-Illusion/memory-cards`

---

## 路线图

### v0.2.x（维护与修复）
- [ ] 收集用户在真机 Obsidian 上的反馈
- [ ] 修复 iOS/Android 中的 visualViewport / visibilitychange 问题
- [ ] 性能优化（大 vault 性能测试）

### v0.3（新题型）
- [ ] 填空题（自动评分）
- [ ] 多选题（单选/多选混合）
- [ ] 题型标记与管理

### v0.4（内容与导出）
- [ ] 图片卡片（遮挡支持）
- [ ] 卡片编辑界面（UI 编辑，无需文本）
- [ ] 导出/导入（JSON / CSV / Anki）

### v1.0（云与协作）
- [ ] 云同步（可选）
- [ ] 多设备同步
- [ ] 协作学习
