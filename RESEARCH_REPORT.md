# Obsidian 闪卡与间隔重复项目调研报告

**调研时间**: 2026-08-13  
**调研范围**: Obsidian 社区插件中与闪卡/间隔重复相关的项目

---

## 一、项目全景对比

### 1. 原生 SRS（不依赖 Anki）

| 项目 | ⭐ Stars | 下载量 | 许可证 | 算法 | 移动端 | 活跃度 |
|------|---------|--------|--------|------|--------|--------|
| [obsidian-spaced-repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition) | 2,520 | 578K | MIT | SM-2 + FSRS | ✅ | 高（2026-08-13 更新） |
| [True Recall](https://github.com/pieralukasz/true-recall) | 56 | 10K | PolyForm Strict（非商用） | FSRS v6 | ❌ 仅桌面 | 高（2026-08-13） |
| [Recall](https://github.com/martin-jw/obsidian-recall) | 139 | 11K | MIT | 可配置多算法 | ✅ | 中（2026-08-09） |
| [obsidian-spaced-repetition-recall](https://github.com/open-spaced-repetition/obsidian-spaced-repetition-recall) | 209 | — | MIT | FSRS-6 | ✅ | 中（2026-07-22） |
| [Better Recall](https://github.com/FlorianWoelki/obsidian-better-recall) | 35 | 4K | MIT | Anki + FSRS | ✅ | 低（2026-08-02） |
| [AOSR](https://github.com/linanwx/aosr) | 90 | 16K | 未声明 | 自研 | ✅ | 低（2026-06-13） |
| Remember (Petr Volf) | — | — | — | FSRS | ✅ | 新发布 |

### 2. Anki 同步类（依赖 Anki 桌面端）

| 项目 | ⭐ Stars | 下载量 | 许可证 | 特点 |
|------|---------|--------|--------|------|
| [Obsidian_to_Anki](https://github.com/ObsidianToAnki/Obsidian_to_Anki) | 2,028 | — | GPL-3.0 | 自定义语法、Python 脚本+插件双模式 |
| [Flashcards (reuseman)](https://github.com/reuseman/flashcards-obsidian) | 1,078 | 71K | MIT | #card 标签、context-aware |
| [Yanki](https://github.com/kitschpatrol/yanki-obsidian) | 191 | 12K | MIT | 纯 Markdown、文件夹→牌组映射 |
| ObsidianAnkiSync | — | 12K | — | 基础同步 |

### 3. 轻量/展示类

| 项目 | ⭐ Stars | 特点 |
|------|---------|------|
| [Simple Flashcards](https://github.com/Railly/obsidian-simple-flashcards) | 15 | RemNote 风格、点击揭示、可选 SRS |
| Flashcard Learning | — | 改进的闪卡学习系统（6K 下载） |

### 4. AI 生成类

| 项目 | 特点 |
|------|------|
| EngramQuest | AI 生成 + FSRS + 视觉记忆图 |
| Flashcards LLM | ChatGPT 自动生卡 |
| Flashcard Generator | 多模型支持 |

---

## 二、关键功能维度分析

### 隐藏答案 / 点击揭示

- **原生方案**: Obsidian callout 语法 `> [!note]- 标题` 可实现折叠，无需插件
- **Simple Flashcards**: 原生支持 click-to-reveal，可配置揭示方式
- **obsidian-spaced-repetition**: 通过 `?` / `??` 分隔符在复习视图中点击揭示答案
- **True Recall**: 复习界面中点击翻转卡片
- **Yanki**: `~~删除线~~` 语法映射为 Anki cloze 隐藏

### 文件夹取牌组

- **obsidian-spaced-repetition**: 支持层级标签 `#flashcards/subdeck` 和文件夹结构两种方式
- **Yanki**: 文件夹层级直接映射为 Anki 牌组层级（最优雅的实现）
- **Obsidian_to_Anki**: 支持自定义扫描目录 + glob 忽略规则
- **True Recall**: Projects 系统，多对多关系组织卡片

### 手动建卡语法

| 插件 | 语法示例 |
|------|---------|
| obsidian-spaced-repetition | `Q::A`（单行）、`Q:::A`（双向）、`Q ? A`（多行） |
| Flashcards (reuseman) | `#card` 标签 + `Q::A`、`==cloze==` |
| Yanki | `---` 分隔前后、`==高亮==` = cloze、`~~删除~~` = 隐藏 |
| Obsidian_to_Anki | 正则自定义（RemNote、Q&A、Neuracache 等风格） |
| Simple Flashcards | `flashcard` 代码块包裹 |

### 调度算法

| 算法 | 使用插件 | 说明 |
|------|---------|------|
| SM-2 | obsidian-spaced-repetition（默认）、Better Recall | 经典算法，30年历史 |
| FSRS v4/v5 | obsidian-spaced-repetition（可选）、Recall、AOSR | 2024年成为新标准 |
| FSRS v6 | True Recall、obsidian-spaced-repetition-recall | 最新，21个可训练参数 |
| ts-fsrs 库 | 多数插件共用 | 754⭐，MIT，TypeScript，官方 FSRS 实现 |

**FSRS vs SM-2**: FSRS 预测召回率准确率高 99.6%，同等保持率下所需复习次数少 20-30%。  
**关键库**: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) — 754⭐，MIT，所有 TypeScript 插件的调度算法首选。

### 移动端体验

- **obsidian-spaced-repetition**: 完全支持移动端，最成熟的移动体验
- **True Recall**: ❌ 仅桌面（manifest.json 标记 desktop-only）
- **Recall / Better Recall / AOSR**: 支持移动端
- **Anki 同步类**: 需要桌面端运行 Anki，移动端体验取决于 Anki 本身

### 许可证

| 许可证 | 项目 | 对我们的影响 |
|--------|------|-------------|
| MIT | obsidian-spaced-repetition, Yanki, Flashcards, Better Recall, Recall, ts-fsrs | ✅ 可自由复用 |
| GPL-3.0 | Obsidian_to_Anki | ⚠️ 衍生作品需开源 |
| PolyForm Strict | True Recall | ❌ 禁止商用和衍生作品 |

---

## 三、可借用代码推荐路线

### 路线 A：基于 obsidian-spaced-repetition 扩展（推荐）

**理由**:
- 578K 下载、2,520⭐，社区最大，bug 修复最快
- MIT 许可证，可自由修改和分发
- 已支持 FSRS + SM-2 双算法
- 已支持文件夹/标签两种牌组组织方式
- 已支持多种卡片语法（Q::A、cloze、多行）
- TypeScript 编写，代码结构清晰

**可复用模块**:
1. `src/cards.ts` — 卡片解析器（支持多种语法）
2. `src/scheduling/` — FSRS/SM-2 调度算法集成
3. `src/decks.ts` — 牌组管理（标签+文件夹）
4. `src/review.ts` — 复习界面逻辑
5. `src/stats.ts` — 统计图表

**需自行实现**:
- 隐藏答案的 callout 交互（可用 Obsidian 原生 callout）
- 更精细的文件夹→牌组映射逻辑

### 路线 B：使用 ts-fsrs 库 + 自建 UI

**理由**:
- ts-fsrs 是官方 FSRS TypeScript 实现，754⭐，MIT
- 算法层与 UI 层解耦，可自由设计前端
- True Recall 就是这种路线的成功案例

**适合场景**: 需要高度定制化的 UI 和交互体验

### 路线 C：Yanki 的文件夹映射思路

**理由**:
- Yanki 的 "文件夹→牌组" 映射逻辑非常优雅
- 纯 Markdown 语法，无需额外标记
- MIT 许可证

**适合场景**: 需要让用户的文件夹结构直接成为牌组层级

---

## 四、总结与建议

### 核心结论

1. **obsidian-spaced-repetition 是事实标准** — 578K 下载，功能最全，社区最活跃
2. **ts-fsrs 是调度算法首选** — 官方实现，MIT，所有新项目都应使用
3. **True Recall 功能最强但许可证受限** — PolyForm Strict 禁止商用和衍生
4. **文件夹→牌组映射** 是高价值功能，Yanki 的实现最优雅
5. **隐藏答案** 可用 Obsidian 原生 callout 语法实现，无需额外代码

### 推荐路线

**首选路线 A**: 基于 obsidian-spaced-repetition 扩展，复用其卡片解析、调度集成、复习界面等核心模块。MIT 许可证允许自由修改。

**补充**: 用 ts-fsrs 替换/增强调度层，参考 Yanki 的文件夹映射逻辑优化牌组组织。

### 需要注意

- obsidian-spaced-repetition 有 318 个 open issues，说明用户量大但也意味着维护压力
- True Recall 的 PolyForm Strict 许可证是硬限制，不可用于商业项目
- Obsidian_to_Anki 的 GPL-3.0 要求衍生作品开源
- 移动端支持是差异化关键，True Recall 放弃移动端是明显短板
