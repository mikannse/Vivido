---
baseline_commit: 57c65e891fc2a44efb8fce4d732cd22d0a0fcbe0
---

# Story 5.1–5.4: 日记分享长图（Epic 5 全量实施）

**Status:** review

来源：`_bmad-output/sprint-change-proposal-2026-07-21.md`（Sprint Change Proposal，Moderate 范围，用户批准后由 dev-story 工作流一次性实施 Epic 5 全部 4 个 stories）。

## Story

As a 想分享日记的用户,
I want 把一篇日记生成一张可分享的长图（标题、日期、正文、图片、标签、品牌水印）,
So that 我可以把它保存到相册或发到朋友圈等社交场景，让记忆以视觉方式被带走。

## Acceptance Criteria

1. DetailScreen 顶部出现分享入口，点击进入 SharePreviewScreen。
2. SharePreviewScreen 可滚动查看完整长图（标题、日期、正文、图片、标签、品牌水印）。
3. 点击保存/分享后生成长图文件，可保存到系统相册或打开系统分享面板。
4. 权限被拒绝时应用不崩溃，并给出引导提示（含「去设置」）。
5. 临时文件在操作完成后被清理。
6. `npx tsc --noEmit` 无类型错误。
7. 边界场景：空标题（显示「无标题」）、无正文/无图/无标签（区块省略）、超长正文（40 行截断）、图片超 6 张（截断）、视频/语音不进长图。

## Tasks/Subtasks

- [x] 更新 bmad 文档：epics.md（FR10/Epic 5/Story 5.1–5.4）、architecture.md（G5/技术基线/项目结构/落点映射）、脑暴文档（原则 6「记忆可带走」+ 潜在方向）
- [x] 安装 `react-native-view-shot@4.0.3` + `expo-media-library@~55.0.19`（npx expo install）；app.json 加 `NSPhotoLibraryAddUsageDescription` 与 `expo-media-library` 插件（Story 5.4 AC）
- [x] Story 5.1：`RootStackParamList` 加 `SharePreview: { diaryId: string }`；App.tsx 注册路由；DetailScreen header 加「分享」入口；screens/index.ts barrel 导出
- [x] Story 5.2：新建 `SharePreviewScreen.tsx` 长图预览 UI——纸张卡片（日期/标题/正文 40 行截断/图片最多 6 张限高/标签/Vivido 水印），空区块省略，theme token + 三款授权字体
- [x] Story 5.3：新建 `services/share.ts`，`captureShareImage` 用 `captureRef`（JPEG q0.9 tmpfile）截取卡片 ref；截图失败弹提示不崩溃
- [x] Story 5.4：`saveImageToLibrary`（writeOnly 权限请求，denied 返回 `{status:'denied', canAskAgain}` 由 UI 引导去设置）、`shareImage`（expo-sharing）、`cleanupShareImage` + `cleanupStaleShareImages`（页面挂载时清 `vivido-share-*` 残留）
- [x] `npx tsc --noEmit` 通过
- [x] 对抗性审查工作流结果处理：
  - [x] 临时文件在途离开泄漏 → captureCard 加 mountedRef 守卫
  - [x] iOS cleanupStaleShareImages 死代码 → 新增 relocateViewShotFile 统一迁入 cacheDirectory
  - [x] 分享后未清理 → handleShare 完成路径加 cleanupShareImage
  - [x] 日期位置与 AC 不符 → 移至卡片底部（水印上方）
  - [x] 正文/图片截断无视觉提示 → 卡片内追加截断指示文案
- [ ] iOS/Android 真机验证（待用户执行）

## Dev Notes

- 架构边界遵守：屏幕只传 `diaryId`，页面内经 `getDiaryById` 取数，不直接开 SQLite。
- NFR4「零新增依赖」的显式例外（NFR8）：`react-native-view-shot` + `expo-media-library`，经变更提案批准。
- 截图目标即预览卡片本身（`collapsable={false}` + ref），保证「所见即所得」。
- JPEG + 0.9 质量是有意的内存缓解（长图像素大，PNG 易 OOM）。
- 临时文件只进 `cacheDirectory`，不进备份；保存相册成功后立即删除临时文件。

## Dev Agent Record

### Debug Log

- 初次实现后自查：`expo-file-system/legacy` 动态 import 改为顶部静态导入（项目惯例）。
- hint 文案从「视频与语音不会进入长图」改为「仅图片会进入长图」（与筛选逻辑 `type === 'image'` 精确一致）。

### Completion Notes

- 对抗性审查确认了 5 个缺陷，全部修复（mountedRef 在途保护、relocateViewShotFile 统一 cacheDirectory、handleShare 后清理、日期移到底部、截断指示）。
- 所有修复经 `npx tsc --noEmit` 验证通过。
- 待真机验证 iOS/Android 的截图和分享流程。

## File List

新增：
- src/screens/SharePreviewScreen.tsx
- src/services/share.ts
- _bmad-output/stories/5-x-share-image.md

修改：
- App.tsx（注册 SharePreview 路由）
- src/types/index.ts（RootStackParamList 加 SharePreview）
- src/screens/DetailScreen.tsx（header 加分享入口）
- src/screens/index.ts（barrel 导出）
- app.json（NSPhotoLibraryAddUsageDescription + expo-media-library 插件）
- package.json（react-native-view-shot、expo-media-library）
- src/services/share.ts（relocateViewShotFile、导入扩增、注释修正）
- src/screens/SharePreviewScreen.tsx（mountedRef、日期底部、截断提示、handleShare 清理、样式新增）
- _bmad-output/epics.md（FR10/NFR8/Epic 5/Story 5.1–5.4）
- _bmad-output/architecture.md（G5/技术基线/项目结构/落点映射）
- _bmad-output/brainstorming/brainstorming-session-2026-07-06-16-00-00.md（原则 6 + 潜在方向）
- _bmad-output/sprint-change-proposal-2026-07-21.md（批准状态）

## Change Log

| 日期 | 变更 |
|------|------|
| 2026-07-21 | 实施 Epic 5 全部 stories（5.1–5.4）：分享入口与路由、长图预览页、view-shot 截图、相册保存与系统分享、临时文件清理；bmad 文档同步更新 |
| 2026-07-21 | 对抗审查修复：mountedRef 在途离开保护、relocateViewShotFile 统一 cacheDirectory、handleShare 后清理、日期移到底部以符合 AC、正文/图片截断提示 |
