# Sprint Change Proposal — Vivido 日记分享长图

**Date:** 2026-07-21  
**Project:** Vivido  
**User:** mikannse  
**Workflow:** Correct Course  
**Mode:** Incremental  
**Scope Classification:** Moderate  

---

## Section 1: Issue Summary

### Trigger

产品负责人/开发者本人提出新增功能：

> **将一篇日记生成一张可分享的长图（标题、正文、图片、标签、日期、品牌水印），用于朋友圈等社交场景。**

### Context

- 该需求不在当前已规划的 Epic 1-4 范围内。
- 当前 Vivido 已完成日记创建、编辑、查看、媒体附件（图片/视频/语音）、标签、搜索、本地备份等核心能力。
- 用户有把记忆以视觉化方式带走的诉求，符合“反云绑架”“记忆可带走”的产品定位。

### Evidence

- 现有架构文档与 Epic 文档中无任何关于“分享”“图片导出”“卡片生成”的条目。
- 当前技术栈：Expo SDK 55 + React Native 0.83，`expo-sharing` 已安装但未用于图片分享，`expo-media-library` / `react-native-view-shot` 尚未引入。
- 当前 `MediaItem.type` 已支持 `'image' | 'video' | 'audio'`，分享长图本期仅使用图片类型。

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | 影响 | 说明 |
|------|------|------|
| Epic 1: 精简回顾岛 | 无 | Discovery 重构与分享功能无关 |
| Epic 2: 更快更自然的记录入口 | 无 | 3秒进入写作与时间分隔线不受影响 |
| Epic 3: 偏好化浏览体验 | 低 | 分享长图视觉风格可与双模式详情保持一致，但不阻塞 |
| Epic 4: 语音日记 | 低 | 本期分享长图只处理图片，语音/视频不进入卡片 |
| **Epic 5: 日记分享长图** | **新增** | 承载本次全部需求 |

### Story Impact

新增 4 个 stories：

- Story 5.1: 分享入口与导航（DetailScreen → SharePreviewScreen）
- Story 5.2: 长图预览页 UI
- Story 5.3: 生成静态长图（`react-native-view-shot`）
- Story 5.4: 保存相册与系统分享（`expo-media-library` + `expo-sharing`）

### Artifact Conflicts

| 制品 | 冲突/更新 |
|------|----------|
| PRD / 头脑风暴 | 无冲突；补充“记忆可带走”产品原则，并将“分享长图”列入未来探索方向 |
| Architecture | 新增 G5 分组、分享技术基线、`SharePreviewScreen` 与 `services/share.ts` 落点、app.json/package.json 配置 |
| UI/UX | 当前无独立 UX 文档；本次明确分享入口、预览页、长图内容结构 |
| package.json | 新增 `react-native-view-shot`、`expo-media-library` |
| app.json | 新增 iOS 相册用途描述、`expo-media-library` 插件注册 |

### Technical Impact

- **新增依赖**：`react-native-view-shot`（视图→长图）、`expo-media-library`（保存相册）。
- **新增文件**：`src/screens/SharePreviewScreen.tsx`、`src/services/share.ts`、可能的 `src/components/ShareCard.tsx`。
- **修改文件**：`DetailScreen.tsx`（加分享入口）、`RootStackParamList`（加 `SharePreview` 路由）。
- **数据模型**：无变化，只读现有 `DiaryEntry`。
- **权限**：iOS `NSPhotoLibraryAddUsageDescription`；Android 相册保存权限由 `expo-media-library` 插件处理。
- **风险点**：
  - 长图高度可能很大，多图/长文场景下内存与截图性能需测试。
  - 临时文件需要及时清理，避免占用存储。

---

## Section 3: Recommended Approach

### Selected Path

**Option 1: Direct Adjustment + 轻量 MVP Review**

- 在当前 backlog 中新增 **Epic 5：日记分享长图** 及 4 个 stories。
- 不改动 Epic 1-4 的范围，保持其原有节奏。
- 将“记忆可带走”补充进产品原则，作为本次变更的理论支撑。

### Rationale

- 该功能是独立、自包含的新能力，不阻塞现有 Epic。
- 技术路径成熟：`react-native-view-shot` 支持 ScrollView/长图截图，`expo-sharing` 与 `expo-media-library` 同属 Expo 生态。
- 用户价值明确：社交分享是可感知、可传播的功能点。
- 风险可控：只读现有数据，不改 schema；性能边界可通过测试兜底。

### Effort Estimate

- **整体工作量：中等（约 3-5 天开发 + 1-2 天测试调优）**
  - Story 5.1：0.5 天
  - Story 5.2：1-1.5 天（长图 UI 设计是主要工作）
  - Story 5.3：1-1.5 天（view-shot 集成 + 性能边界）
  - Story 5.4：0.5-1 天（权限 + 保存/分享 + 清理）

### Risk Assessment

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 长图截图内存溢出 | 中 | 限制正文最大行数、限制图片数量/尺寸、使用 JPEG 格式 |
| iOS/Android 权限被拒 | 低 | 拒绝时提示用户手动开启，不崩溃 |
| 临时文件堆积 | 低 | 保存/分享完成后删除临时文件 |
| 品牌水印/字体侵权 | 低 | 使用应用自有品牌 Vivido + 已授权字体 |

### Timeline Impact

- 若插入当前 sprint：需要评估 Epic 3/4 容量，可能将 Epic 5 作为第三批并行的独立里程碑。
- 若放入后续 sprint：不影响当前 sprint 交付。

---

## Section 4: Detailed Change Proposals

### 4.1 Epic 新增

**Story 文件：** `_bmad-output/epics.md`

```markdown
### Epic 5: 日记分享长图

把单篇日记生成一张可分享的长图，用于朋友圈等社交场景，让记忆以视觉方式被带走。

**FRs covered:** FR10（新增）
**内聚理由:** 独立功能：分享入口 → 预览/编辑页 → 长图渲染 → 保存/分享。与既有记录/浏览/媒体管道低耦合。
**批次:** 可作为第三批并行的独立里程碑，或在 Epic 3 完成后接入。 | **风险:** 中（长图截图性能、多图内存、权限配置）
```

### 4.2 Story 新增

详见 `epics.md` 中新增的 Story 5.1 - 5.4。

### 4.3 Architecture 文档更新

详见 `architecture.md` 中：

- FRs 分组表新增 G5
- 技术基线新增分享长图依赖
- 项目结构图新增 `SharePreviewScreen.tsx` 与 `services/share.ts`
- 需求→文件落点映射新增分享长图

### 4.4 PRD / 脑暴文件补充

详见 `brainstorming-session-2026-07-06-16-00-00.md` 中：

- 核心产品原则新增第 6 条“记忆可带走”
- 潜在方向新增“日记分享长图”

### 4.5 package.json / app.json 更新

- `package.json`：新增 `react-native-view-shot`、`expo-media-library`
- `app.json`：新增 iOS `NSPhotoLibraryAddUsageDescription`，`plugins` 中注册 `expo-media-library`

---

## Section 5: Implementation Handoff

### Scope Classification

**Moderate（中等）**

- 新增独立 Epic 与多个 stories
- 引入新的原生依赖与权限配置
- 需要 UI/UX 决策（长图布局、水印、截断规则）
- 不改动核心数据模型，但涉及 DetailScreen 导航与临时文件生命周期管理

### Handoff Recipients

| 角色 | 责任 |
|------|------|
| **Product Owner / 你本人** | 确认长图视觉风格、水印文案、正文/图片截断规则；更新 backlog 状态 |
| **Developer agent** | 实现 `SharePreviewScreen`、`services/share.ts`、路由、权限、保存/分享逻辑 |
| **QA / 你本人** | 测试长图在不同内容长度、多图、无图、权限被拒等场景的表现 |

### Success Criteria

1. DetailScreen 顶部出现分享入口，点击进入 SharePreviewScreen。
2. SharePreviewScreen 可滚动查看完整长图（标题、日期、正文、图片、标签、品牌水印）。
3. 点击保存/分享后生成长图文件，可保存到系统相册或打开系统分享面板。
4. 权限被拒绝时应用不崩溃，并给出引导提示。
5. 临时文件在操作完成后被清理。
6. `npx tsc --noEmit` 无类型错误。
7. iOS/Android 真机或模拟器上验证通过。

---

## Section 6: Approval

**Status:** ✅ 已批准并实施（2026-07-21）

- **yes**：批准此 Sprint Change Proposal，进入实施 ✅（用户于 2026-07-21 批准，由 dev-story 工作流实施）
- ~~no~~ / ~~revise~~

**实施记录：** Epic 5（Story 5.1–5.4）已在单次执行中完成实施，`npx tsc --noEmit` 通过。详见 `_bmad-output/stories/5-x-share-image.md`。
