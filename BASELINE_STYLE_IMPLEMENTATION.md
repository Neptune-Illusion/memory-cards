# Baseline 风格实现报告

**版本**: v0.3.0  
**时间**: 2026-08-13  
**状态**: ✅ 111 tests pass, build clean

---

## 改动清单

### styles.css — 完全重写

**风格变更**:
- 所有颜色改为 Obsidian/Baseline 语义变量（`--background-secondary`, `--text-muted`, `--interactive-accent` 等）
- 无硬编码 hex 颜色（仅变量 fallback 中的 `rgba(0,0,0,0.05)`）
- 圆角使用 `var(--mc-radius)` → `var(--button-radius, 6px)`
- 过渡动画使用 `var(--anim-duration-fast, 160ms)`
- 评分按钮添加 `border: 1px solid var(--mc-border)`（Baseline thin-border 风格）

**移动安全变更**:
| 机制 | 实现 |
|------|------|
| 视口高度 | `max-height: 100dvh`（动态视口，键盘弹出时自动缩小） |
| Safe-area | 四边 `env(safe-area-inset-*)` padding |
| 内容滚动 | `.modal-content { flex: 1 1 0%; min-height: 0; overflow-y: auto }` |
| 防溢出 | `overscroll-behavior: contain` + `-webkit-overflow-scrolling: touch` |
| Header/Actions | `flex-shrink: 0` 确保不被压缩 |
| iOS 缩放 | `font-size: 16px` 防止自动缩放 |
| 触摸目标 | `--mc-touch: 48px`（小屏 44px，横屏 40px） |
| 横屏适配 | `@media (max-height: 500px) and (orientation: landscape)` |
| 减少动画 | `@media (prefers-reduced-motion: reduce)` |

**响应式断点**:
- ≤480px: 小屏手机（320x568, 360x640）
- ≥600px: 平板（4列评分按钮）
- ≥1024px: 桌面
- max-height:500px + landscape: 横屏手机

### tests/css-contract.test.ts — 新增

22 项 CSS 静态契约测试：
- 语义变量使用（7 项）
- 无 position:fixed（1 项）
- Safe-area insets（1 项）
- dvh 视口（1 项）
- flex 收缩（1 项）
- 触摸目标尺寸（1 项）
- 减少动画（1 项）
- 响应式断点（3 项）
- 横屏处理（1 项）
- Baseline thin-border（1 项）
- 变量化圆角/过渡（2 项）
- 移动安全专项（6 项）

### README.md — 更新

- 版本号 v0.2.1 → v0.3.0
- 添加 Baseline 风格和移动安全说明
- 更新测试数量 60 → 111
- 更新已验证功能列表

---

## 不变项

- `src/` 无改动（CSS-only 变更）
- `manifest.json` 无改动
- 所有现有 89 个功能测试继续通过
