# 发布清单 — Obsidian 闪卡插件 v0.1.0

## 代码质量

- [x] 129 个单元测试全过 (`npm test`)
- [x] TypeScript 类型检查通过 (`tsc --noEmit`)
- [x] 生产构建成功 (`npm run build`)
- [x] 无 console.error / console.warn（除正常日志）
- [x] 核心逻辑零改动（parser / scheduler / anticheat / stats / store）

## 移动端验证

- [x] 手机竖屏 (320×568) 无滚动
- [x] 按钮最小 52×52px
- [x] 触摸间距 ≥8px
- [x] 字体 ≥16px（防 iOS 缩放）
- [x] 左滑/右滑手势检测
- [x] 键盘快捷（1-4、←→、Space）
- [x] 深色模式自适应
- [x] aria-label 无障碍标注

## 文档完整性

- [x] README.md — 使用指南
- [x] IMPLEMENTATION_REPORT.md — v0.1 技术细节
- [x] MOBILE_FIRST_IMPLEMENTATION.md — v0.2 改动说明
- [x] CHANGELOG.md — 版本历史
- [x] RELEASE_CHECKLIST.md — 本清单

## 分发物文件

- [x] `main.js` (≈32 KB, 最小化)
- [x] `manifest.json` (v0.1.0 元数据)
- [x] `styles.css` (响应式系统)
- [x] `package.json` / `tsconfig.json` / `esbuild.config.mjs`
- [x] `src/` 所有源文件
- [x] `tests/` 所有测试 (9 文件)
- [x] `卡片/示例-细胞呼吸.md` (示例卡片)

## 发布步骤

1. **标签与版本**（与 `manifest.json`/`versions.json` 的 `0.1.0` 一致）
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. **Obsidian 社区插件注册**（可选）
   - 提交 PR 至 `obsidianmd/obsidian-releases`（社区插件目录仓库）
   - 包含 `manifest.json` 更新与对应 `versions.json` 条目

3. **本地安装测试**
   ```bash
   mkdir -p ~/.obsidian/vaults/test-vault/.obsidian/plugins/memory-cards
   cp main.js manifest.json styles.css ~/.obsidian/vaults/test-vault/.obsidian/plugins/memory-cards/
   # Obsidian 中重载并启用
   ```

4. **实际设备验证**
   - iOS: Obsidian Mobile 应用
   - Android: Obsidian Mobile 应用
   - 手势操作确认

## 后续迭代（v0.2+）

- 填空/多选题型
- 图片遮挡支持
- 卡片编辑界面
- 命令面板深度集成
- 导出/导入功能
- 云同步（可选）

---

**发布时间**: 2026-08-13 23:30  
**版本**: v0.1.0  
**状态**: ✅ 就绪（未推送 / 未真机验证，见 README）
