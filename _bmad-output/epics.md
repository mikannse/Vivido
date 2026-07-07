---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-07-07'
inputDocuments:
  - '_bmad-output/architecture.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-06-16-00-00.md'
sourceOfTruth: 'src/ 实际源码；docs/ 已过时，不作为依据'
project_name: 'Vivido'
---

# Vivido - Epic Breakdown

## Overview

本文档将 Vivido 下一阶段迭代的需求（源自架构文档与头脑风暴 session）分解为可实现的 epic 与 story。需求实质来自头脑风暴的 7 个功能 + 5 条产品原则，并已被架构文档吸收为 4 个 ADR。事实来源为 `src/` 实际源码。

## Requirements Inventory

### Functional Requirements

FR1: 移除 Discovery（回顾岛）中的活动热力图功能，并清理相关数据流与 UI，不影响共用的日期聚合逻辑。
FR2: 首页日记列表按时间自然分组，显示轻量时间分隔线（如"今天""3天前""上个月"）。
FR3: Discovery 词云中每个词可点击，点击后触发对该词的搜索/筛选，使词云成为导航入口。
FR4: 优化词云统计算法——本地规则过滤无意义语气词/通用词，优先呈现能反映生活主题的词，不引入 AI/分词库。
FR5: 从打开应用到进入可输入状态（新建/编辑日记）控制在极短路径内，无多余弹窗、loading 或选择项。
FR6: 首页支持两种浏览布局（时间线瀑布流 / 卡片轮播），用户可通过顶部按钮切换，且切换偏好被持久化记忆。
FR7: 日记详情页支持两种呈现模式（精致阅读模式 / 随手记模式），用户可切换，且模式偏好被持久化记忆。
FR8: 媒体附件新增"语音（原声录音）"类型，与图片/视频平级，支持录音、播放、删除；不做语音转文字。
FR9: 语音附件纳入备份导入导出，且旧版本备份（不含语音）仍可正常导入。

### NonFunctional Requirements

NFR1（无 AI）：不引入任何 AI 生成、AI 推荐、AI 情绪总结等能力；记忆诠释权归用户。硬边界。
NFR2（完全本地）：无网络层、无云同步；所有能力围绕本地 SQLite + 文件沙盒。
NFR3（性能·3秒进入写作）：进入 Editor 的路径禁止 loading/弹窗，保证极速进入输入状态。
NFR4（克制极简）：零新增第三方依赖；倾向删代码优于加代码；不引入全局状态库。
NFR5（不惩罚简短）：数据模型容忍空标题、空媒体、极短正文；一句话/一张图/一段语音都是合法日记。
NFR6（尊重自主权）：提供选择（布局切换、详情模式），不替用户决定；不制造 streak 压力。
NFR7（备份向后兼容）：SCHEMA_VERSION 2→3 与 BACKUP_VERSION 2→3 演进后，旧备份必须仍可导入。

### Additional Requirements

（来自架构文档 4 个 ADR 与强制规则，影响实现）

- AR1（ADR-1 偏好持久化基元）：新建 `src/services/preferences.ts` + `src/hooks/usePreference.ts`，复用已装的 `expo-sqlite/kv-store` 的 `Storage`（`import { Storage } from 'expo-sqlite/kv-store'`），用 `getItemSync` 首帧同步读以消除布局跳变。键名规范 `pref.<域>.<项>`（`pref.home.layout` / `pref.detail.mode`）。偏好独立于业务库、不进备份、不触发业务 schema 迁移。FR6/FR7 的共同前置。
- AR2（ADR-2 语音媒体契约）：`MediaItem.type` 联合类型放宽为 `'image' | 'video' | 'audio'`；复用 `media` 表，不建新表；录音 `recorder.uri`（.m4a）经 `storage.saveMedia` 落盘，继承现有媒体管道（CRUD/备份/级联删除/position 排序）。`thumbnail` 列对 audio 留空。
- AR3（ADR-3 Schema+Backup 协同演进）：`SCHEMA_VERSION 2→3`（`media.type` 是 TEXT 列，无需 ALTER TABLE，`MIGRATIONS[3]` 为空迁移仅登记版本）；`BACKUP_VERSION 2→3`。
- AR4（备份版本白名单强制约束）：`parseBackupManifest` 现有校验 `parsed.version !== 1 && parsed.version !== BACKUP_VERSION`（backup.ts:98-101）只接受"1 或当前版本"，若把 BACKUP_VERSION 直接改 3 会拒绝所有 v2 老备份。必须改为显式白名单 `SUPPORTED_BACKUP_VERSIONS = [1, 2, 3]`。
- AR5（iOS 麦克风权限）：语音功能落地前必须在 `app.json` 的 `expo.ios.infoPlist` 添加 `NSMicrophoneUsageDescription`（Android 权限已齐），否则 iOS 录音崩溃。录音前需 `setAudioModeAsync({ allowsRecording: true })`。
- AR6（ADR-4 词云算法）：词云优化收敛在 `getWordFrequency`（或抽 `utils/wordcloud.ts`），扩充停用词表 + 词频/字长启发式优先多字词；默认零依赖规则，词典方案为可选增强。
- AR7（既有约定固化）：DB 列名用 camelCase（非 snake_case）；时间戳用 number 毫秒（备份 manifest 除外）；Service 函数为具名 async 箭头 + `if(!db)` 守卫 + 批量写用事务；颜色/字体走 `src/theme` token。
- AR8（主题债务顺手清理）：`WordCloud.tsx` 当前硬编码色值/字体，改词云时迁移到 theme token。

### UX Design Requirements

（无独立 UX 文档；交互要点已并入对应 FR，不单列 UX-DR）

### FR Coverage Map

| FR | Epic | 说明 |
|----|------|------|
| FR1 | Epic 1 | 移除热力图 |
| FR2 | Epic 2 | 时间分隔线 |
| FR3 | Epic 1 | 词云可点击 |
| FR4 | Epic 1 | 词云算法优化 |
| FR5 | Epic 2 | 3秒进入写作 |
| FR6 | Epic 3 | 首页双布局 |
| FR7 | Epic 3 | 双模式详情 |
| FR8 | Epic 4 | 语音附件 |
| FR9 | Epic 4 | 语音备份兼容 |

全部 9 个 FR 已覆盖，无遗漏。NFR/AR 作为横切约束贯穿各 epic 的验收标准。

## Epic List

### Epic 1: 精简回顾岛（Discovery 重构）
回顾日记时界面更聚焦、更少压力（去掉制造"没写"羞愧的热力图），词云从静态展示变为可点击的时间旅行入口，且更懂中文语境。
**FRs covered:** FR1, FR3, FR4
**内聚理由:** 三者全部改 `useDiscovery.ts` + `DiscoveryScreen.tsx` + `WordCloud.tsx`，同一批文件端到端。
**批次:** 脑暴第一批 + 第二批(FR4) | **风险:** 低–中

### Epic 2: 更快更自然的记录入口
打开即写，3 秒内进入输入状态；浏览时间线时有轻量时间感分组。降低动笔摩擦。
**FRs covered:** FR2, FR5
**内聚理由:** 都是"记录/浏览摩擦"主题的轻量改动（Home/Editor/App 启动链路）。
**批次:** 第一批(FR2) + 第二批(FR5) | **风险:** 低

### Epic 3: 偏好化浏览体验（双布局 + 双模式）
按心情选择首页布局（时间线/轮播）与详情呈现（精致/随手记），选择被记住。尊重自主权。
**FRs covered:** FR6, FR7
**内聚理由:** 共享 ADR-1 偏好持久化基元——先建 `preferences.ts`+`usePreference.ts`，两功能都依赖它。
**批次:** 第二批 | **风险:** 中（含新基元）

### Epic 4: 语音日记（原声附件）
用声音记录此刻——语气、停顿、环境音本身就是记忆。与图文视频平级。
**FRs covered:** FR8, FR9
**内聚理由:** 全栈纵切（types→db→storage→backup→组件+app.json），独立里程碑。
**批次:** 第三批 | **风险:** 高

**依赖与推荐顺序:** Epic 1、2 完全独立可先做；Epic 3 须先建 ADR-1 基元（epic 内首个 story）；Epic 4 独立但最重，须先补 iOS 麦克风权限(AR5)。推荐顺序 1 → 2 → 3 → 4。

## Epic 1: 精简回顾岛（Discovery 重构）

回顾日记时界面更聚焦、更少压力，词云从静态展示变为可点击的时间旅行入口，且更懂中文语境。

### Story 1.1: 移除热力图

As a 想安静回顾日记的用户,
I want Discovery 页面不再显示活动热力图,
So that 我不会因为"哪天没写"而感到羞愧压力，界面更聚焦。

**Acceptance Criteria:**

**Given** 用户打开 Discovery（回顾岛）页面
**When** 页面加载完成
**Then** 不再渲染 `ActivityHeatmap` 组件
**And** `ActivityHeatmap.tsx` 从 `components/` 与 `components/index.ts` 移除

**Given** `useDiscovery` hook 执行数据获取
**When** `fetchData` 运行
**Then** 不再调用 `getHeatmapData`，`heatmapData` 状态与相关返回值被移除
**And** 词云、搜索、标签、时间筛选功能不受影响，仍正常工作

**Given** 代码库中 `getHeatmapData` 与 `buildDiscoveryWhereClause` 共用日期聚合逻辑
**When** 移除热力图数据流
**Then** 不误删 `buildDiscoveryWhereClause` 及被搜索/词云共用的日期逻辑
**And** `npx tsc --noEmit` 无类型错误

### Story 1.2: 词云可点击筛选

As a 回顾日记的用户,
I want 点击词云里的某个词就能看到包含它的日记,
So that 词云成为探索过去的入口，而非只能看的图。

**Acceptance Criteria:**

**Given** Discovery 页面已渲染词云（`WordCloud` 已具备 `onWordPress` prop）
**When** 用户点击词云中的某个词
**Then** 该词被填入搜索框（`setSearchQuery`），触发对该词的搜索筛选
**And** 日记列表更新为包含该词的条目

**Given** 用户点击了某个词进行筛选
**When** 用户查看筛选结果
**Then** 当前生效的搜索词有可见反馈（搜索框显示该词）
**And** 用户可清除该筛选恢复原视图

### Story 1.3: 词云算法优化（并清理主题债务）

As a 回顾日记的用户,
I want 词云展示的是能反映我生活主题的词，而非"的/了/是"这类虚词,
So that 词云真正让我看见自己关注的东西。

**Acceptance Criteria:**

**Given** `getWordFrequency` 统计词频
**When** 提取词语
**Then** 扩充后的本地停用词表过滤高频虚词/语气词
**And** 用词频/字长启发式优先呈现更有意义的多字词
**And** 全程不调用任何 AI 或引入分词第三方库（遵守 NFR1/NFR4）

**Given** `WordCloud.tsx` 当前硬编码了色值与字体
**When** 实现本 story
**Then** 顺手将硬编码的 `#a89080`/`#c47030`/`#3d2c1e` 与 `fontFamily` 迁移到 `src/theme` token（AR8）

**Given** 词云优化逻辑
**When** 代码组织
**Then** 分词/过滤逻辑收敛在 `getWordFrequency`（或抽到 `utils/wordcloud.ts`），不外溢到组件

**Given** Discovery 页面有活跃的时间筛选器（本周/本月/指定日期）
**When** 词云计算词频
**Then** 词云始终只统计近 30 天的日记数据，不跟随当前时间筛选器（决策 2026-07-08）

> **决策 2026-07-07：** 本期仅做零依赖的停用词 + 词频/字长启发式规则；ADR-4 预留的本地词典方案不入本期范围，留作后续可选增强。

## Epic 2: 更快更自然的记录入口

打开即写，3 秒内进入输入状态；浏览时间线时有轻量时间感分组。

### Story 2.1: 时间线时间分隔线

As a 浏览首页日记列表的用户,
I want 列表按时间自然分组并显示轻量分隔线,
So that 我能快速感知"今天""几天前""上个月"的时间脉络。

**Acceptance Criteria:**

**Given** 首页日记列表包含跨越不同时间段的条目
**When** 列表渲染
**Then** 条目按时间自然分组，组间显示轻量时间分隔线（如"今天""3天前""上个月"）
**And** 分隔线复用 `utils/date.ts` 的现有日期逻辑，不新增花哨 UI

**Given** 列表使用分页加载（`getDiariesPaginated`）
**When** 用户下拉加载更多
**Then** 分隔线在新加载条目中正确延续，不重复/不错位
**And** 空标题日记等既有行为不受影响（NFR5）

### Story 2.2: 3 秒进入写作

As a 想随手记录的用户,
I want 打开应用后极快进入可输入状态,
So that 灵感不因等待/弹窗而流失。

**Acceptance Criteria:**

**Given** 用户从首页点击"新建日记"
**When** 进入 Editor 页面
**Then** 路径中无多余弹窗、无 loading 遮挡、无选择项阻塞（NFR3）
**And** 键盘/输入框尽快可用

**Given** 应用启动链路（`App.tsx` 的字体加载 + DB init）
**When** 审查进入写作的路径
**Then** 识别并移除进入 Editor 前不必要的阻塞
**And** 不破坏既有草稿自动保存与数据初始化

## Epic 3: 偏好化浏览体验（双布局 + 双模式）

按心情选择首页布局与详情呈现，选择被记住。

### Story 3.1: 首页双布局切换（含偏好持久化基元）

As a 浏览首页的用户,
I want 在"时间线瀑布流"和"卡片轮播"两种布局间切换，且切换被记住,
So that 我能用不同心态浏览回忆（纵览轨迹 / 翻阅回忆）。

**Acceptance Criteria:**

**Given** 项目当前无偏好持久化机制
**When** 实现本 story
**Then** 新建 `src/services/preferences.ts` + `src/hooks/usePreference.ts`，复用 `expo-sqlite/kv-store` 的 `Storage`（`import { Storage } from 'expo-sqlite/kv-store'`）
**And** 用 `getItemSync` 首帧同步读取偏好以消除布局跳变
**And** 偏好独立于业务库、不进备份、不触发业务 schema 迁移（AR1）
**And** 不引入任何新第三方依赖（NFR4）

**Given** 首页顶部有布局切换按钮
**When** 用户在"时间线瀑布流"和"卡片轮播"间切换
**Then** 首页立即以所选布局渲染（键 `pref.home.layout` = `'timeline' | 'carousel'`）
**And** 下次进入首页时首帧即按上次选择渲染，无默认→实际的跳变

**Given** 卡片轮播布局需要卡片组件
**When** 实现轮播
**Then** 复用或新增卡片组件，颜色/字体走 theme token
**And** 两种布局都能正确显示日记的标题/媒体/标签

> **决策 2026-07-07：** 新建独立 `CarouselCard.tsx`（大图单焦点卡片），与瀑布流 `TimelineCard` 分离，不复用同一组件。

### Story 3.2: 双模式详情页

As a 阅读单篇日记的用户,
I want 在"精致阅读模式"和"随手记模式"间切换，且选择被记住,
So that 同一篇日记可按心情呈现为一封信或一张便签。

**Acceptance Criteria:**

**Given** Story 3.1 已建立 `usePreference` 基元
**When** 实现详情双模式
**Then** 复用 `usePreference`，键 `pref.detail.mode` = `'refined' | 'quick'`
**And** 不重复造持久化机制

**Given** 详情页有模式切换入口
**When** 用户切换呈现模式
**Then** 详情页以所选模式重新渲染（精致 / 随手记两套样式）
**And** 下次进入详情页首帧即按上次选择渲染

**Given** 用户在两种模式间切换
**When** 查看内容
**Then** 两种模式都完整呈现正文、媒体、标签，仅呈现样式不同
**And** 既有的前后导航、删除等功能不受影响

## Epic 4: 语音日记（原声附件）

用声音记录此刻——语气、停顿、环境音本身就是记忆。

### Story 4.1: 录音并保存为日记附件

As a 想用声音记录的用户,
I want 在编辑日记时录制一段语音并作为附件保存,
So that 我能封存当下的原声，而不必打字。

**Acceptance Criteria:**

**Given** iOS 当前缺少麦克风用途描述
**When** 实现本 story
**Then** 在 `app.json` 的 `expo.ios.infoPlist` 添加 `NSMicrophoneUsageDescription`（中文文案）（AR5）
**And** 录音前调用 `setAudioModeAsync({ allowsRecording: true })`

**Given** 数据模型当前仅支持 image/video
**When** 引入语音类型
**Then** `MediaItem.type` 放宽为 `'image' | 'video' | 'audio'`（AR2）
**And** `SCHEMA_VERSION` 升 2→3，`MIGRATIONS[3]` 为空迁移仅登记版本（`media.type` 是 TEXT 列，无需 ALTER TABLE）（AR3）
**And** audio 复用 `media` 表，`thumbnail` 列留空，不建新表

**Given** 用户在 Editor 中通过 `MediaPicker` 选择"录音"
**When** 用户录制并停止
**Then** 新增 `AudioRecorder` 组件用 `useAudioRecorder(RecordingPresets...)` 录制，产出 `.m4a`
**And** 录音经 `storage.saveMedia` 落盘到 `documentDirectory/media/`，与图片/视频同管道
**And** 语音附件与图片/视频平级参与 position 排序

**Given** 录音存在边界场景
**When** 用户录了 0 秒/空录音、或权限被拒、或录音被来电打断
**Then** 空录音（时长<阈值或 size=0）被丢弃不入库（E1）
**And** 权限被拒时引导用户去设置且不崩溃（E4，`getRecordingPermissionsAsync`）
**And** 录音被打断时停止并保存已录部分（E3）

### Story 4.2: 播放与删除语音附件

As a 回看日记的用户,
I want 播放日记里的语音附件并能删除它,
So that 我能重听当时的声音，也能管理这些附件。

**Acceptance Criteria:**

**Given** 某篇日记含 audio 附件
**When** 用户在详情页/媒体浏览中打开该附件
**Then** 新增 `AudioPlayer` 组件用 `useAudioPlayer` 播放，显示播放/暂停与进度
**And** 同一时刻只播放一条语音，组件卸载时自动释放（E9）

**Given** 用户想删除某条语音附件
**When** 用户执行删除
**Then** 复用现有媒体删除逻辑（`deleteMedia`/`deleteDiaryMedia`），文件与 media 行一并移除
**And** 级联删除、删除容错行为与图片/视频一致

**Given** audio 附件在列表/详情中展示
**When** 渲染
**Then** 图片/视频/语音三类附件都能正确区分呈现（如语音显示可播放标识）
**And** 颜色/字体走 theme token

### Story 4.3: 语音纳入备份且旧备份仍可导入

As a 珍视数据的用户,
I want 语音附件能被备份导出/导入，同时我现有的旧备份仍能导入,
So that 换机迁移时语音不丢，且不废掉我已有的备份。

**Acceptance Criteria:**

**Given** 备份导出流程
**When** 导出含 audio 的日记
**Then** audio 文件写入备份 ZIP 的 media 目录，manifest 记录 `type:'audio'` 与 mimeType `audio/mp4`（AR2）
**And** `BACKUP_VERSION` 升 2→3

**Given** `parseBackupManifest` 现有校验为 `parsed.version !== 1 && parsed.version !== BACKUP_VERSION`
**When** 升级 BACKUP_VERSION 到 3
**Then** 改为显式白名单 `SUPPORTED_BACKUP_VERSIONS = [1, 2, 3]`（AR4）
**And** media type 校验放宽以接受 `'audio'`

**Given** 用户持有旧的 version:2（不含语音）备份
**When** 用户在新版本导入该旧备份
**Then** 旧备份成功导入，图片/视频/标签/日记完整恢复（NFR7）
**And** `schemaVersion`（老 2 ≤ 新 3）与 `appVersion` 校验对旧备份天然放行

**Given** 导入含 audio 的新备份
**When** 导入
**Then** audio 文件正确落盘、media 行正确重建
**And** 缺失音频文件时复用现有 `Missing media file` 报错逻辑（E6）
