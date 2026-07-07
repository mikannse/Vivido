---
id: SPEC-vivido-next
companions:
  - ../../architecture.md   # 采纳（adopted）：4 个 ADR、命名/结构/过程约定、7 条强制规则、文件落点映射、语音边界防护（E1/E3/E4/E5）。由架构技能拥有，本 SPEC 不编辑。
  - ../../epics.md          # 采纳（adopted）：4 Epic / 10 Story 的 Given-When-Then 验收标准（比内核更细粒度，实现侧必读）。
sources: []                 # 无「已被内核完全吸收、下游无需再读」的源文件——epics/architecture 均仍有下游价值，故列为 companions。
---

> **Canonical contract.** 本 SPEC 与 `companions:` 中的文件共同构成「建什么、测什么、验什么」的完整契约。ADR 证据、Story 级验收标准、约定与文件映射在两份采纳文档中，本内核不复制它们，仅蒸馏出可判定的能力契约与硬约束。

# Vivido 下一阶段：克制、可选、有声的本地日记

## Why

**要实现的愿景 + 要解决的痛点。** Vivido 是一款完全本地的图文日记应用，下一阶段迭代要把它推向三个方向：**降低动笔摩擦**（打开即写，不让灵感在 loading/弹窗里流失）、**尊重用户自主权**（把回顾/浏览/呈现的选择权交还用户，而非用 AI 替他诠释记忆），以及**让声音成为一等记忆**（语气、停顿、环境音本身就是记忆，应与图文视频平级）。这一切在「无 AI、完全本地、克制极简」五条产品原则的硬边界内完成——本次的每一个下游权衡都以这三个方向和五条原则为锚。需求来自一次头脑风暴（7 功能 + 5 原则），已被架构文档吸收为 4 个可独立拍板的 ADR，事实来源是 `src/` 实际源码。

## Capabilities

- id: CAP-1
  intent: 用户在回顾岛（Discovery）回顾日记时，界面不再出现活动热力图。
  success: `DiscoveryScreen` 不渲染 `ActivityHeatmap`（组件从 `components/` 与 barrel 移除），`useDiscovery` 不再调用 `getHeatmapData` 且移除 `heatmapData` 状态；词云/搜索/标签/时间筛选仍正常；不误删被搜索/词云共用的 `buildDiscoveryWhereClause` 日期逻辑；`npx tsc --noEmit` 通过。

- id: CAP-2
  intent: 首页日记列表按时间自然分组，组间显示轻量时间分隔线（如"今天""3天前""上个月"）。
  success: 跨时间段的列表渲染出正确分组分隔线（复用 `utils/date.ts`，不新增花哨 UI）；分页加载（`getDiariesPaginated`）下拉时分隔线正确延续、不重复不错位；空标题等既有行为不受影响。

- id: CAP-3
  intent: 用户点击词云中的某个词，即可筛选出包含该词的日记。
  success: 点击词 → `setSearchQuery` 填入该词并触发筛选 → 列表更新为含该词条目 → 搜索框显示该词且可清除恢复原视图。

- id: CAP-4
  intent: 词云优先呈现能反映生活主题的词，而非"的/了/是"这类虚词与语气词。
  success: 扩充后的本地停用词表过滤高频虚词；词频/字长启发式优先多字词；全程不调用任何 AI、不引入分词第三方库、**不引入本地词典**（本期仅零依赖规则，词典方案为已裁定的后续可选增强，不在本期范围）；分词/过滤逻辑收敛在 `getWordFrequency`（或抽到 `utils/wordcloud.ts`），不外溢到组件。词云数据采样窗口始终为**近 30 天**，不受 Discovery 页面的时间筛选器影响（决策 2026-07-08）。

- id: CAP-5
  intent: 用户打开应用后，经极短路径进入可输入状态（新建/编辑日记）。
  success: 进入 Editor 的路径中无多余弹窗、无 loading 遮挡、无阻塞性选择项；键盘/输入框尽快可用；既有草稿自动保存与数据初始化不被破坏。

- id: CAP-6
  intent: 用户在"时间线瀑布流"与"卡片轮播"两种首页布局间切换，切换偏好被持久记忆。
  success: 顶部按钮切换后首页即时以所选布局重渲染（键 `pref.home.layout` = `'timeline' | 'carousel'`）；下次进入首页首帧即按上次选择渲染、无"默认→实际"跳变；轮播布局用新建的 `CarouselCard`（大图单焦点卡片，与瀑布流 `TimelineCard` 分离）；两种布局都正确显示日记的标题/媒体/标签。

- id: CAP-7
  intent: 用户在"精致阅读模式"与"随手记模式"两种详情呈现间切换，模式偏好被持久记忆。
  success: 切换后详情页即时以所选模式重渲染（键 `pref.detail.mode` = `'refined' | 'quick'`，复用 CAP-6 建立的 `usePreference` 基元、不重复造持久化）；下次进入详情首帧即按上次选择；两种模式都完整呈现正文/媒体/标签、仅样式不同；前后导航与删除不受影响。

- id: CAP-8
  intent: 用户在编辑日记时录制一段语音，并作为与图片/视频平级的附件保存、播放、删除。
  success: 录音（`useAudioRecorder`，产出 `.m4a`）经 `storage.saveMedia` 落盘到 `documentDirectory/media/`、写入 `media` 表 `type='audio'`、参与 position 排序；`AudioPlayer` 可播放且同一时刻只播一条、卸载即释放；删除复用 `deleteMedia`/`deleteDiaryMedia` 连文件带行移除；空录音（时长<阈值或 size=0）丢弃不入库、权限被拒引导去设置不崩、录音被打断则停止并保存已录部分。

- id: CAP-9
  intent: 语音附件纳入备份导入导出，且旧版本（不含语音）备份仍可正常导入。
  success: 导出含 audio 的日记时音频文件写入备份 ZIP 的 media 目录、manifest 记录 `type:'audio'` 与 mimeType `audio/mp4`，`BACKUP_VERSION` 升 2→3；`parseBackupManifest` 改为显式白名单 `SUPPORTED_BACKUP_VERSIONS=[1,2,3]` 且放宽 media type 校验接受 `'audio'`；持有 `version:2` 旧备份的用户在新版本导入后图片/视频/标签/日记完整恢复；导入缺失音频文件时复用现有 `Missing media file` 报错逻辑。

## Constraints

- **无 AI（硬边界）**：禁止任何 AI 生成、AI 推荐、AI 情绪总结、语音转文字；词云"智能化"只能走本地规则/词典路线，绝不引入模型调用。记忆诠释权归用户。
- **完全本地**：无网络层、无云同步；所有能力围绕本地 SQLite + 文件沙盒。
- **零新增第三方依赖**：全部能力必须在现有技术栈（Expo SDK 55 / RN 0.83 / 已装 `expo-sqlite`、`expo-audio`、`react-native-zip-archive`）上完成；倾向删代码优于加代码。
- **不引入全局状态库**：禁止用 Redux/Zustand/Context 做数据流；SQLite 是唯一真相源，页面用 `useFocusEffect` 聚焦重拉。
- **进入 Editor 路径禁止 loading/弹窗**：这是"3 秒进入写作"的硬指标，约束启动链路（字体加载、DB init、导航）的改动方式。
- **不惩罚简短**：数据模型必须容忍空标题、空媒体、极短正文——一句话/一张图/一段语音都是合法日记（现状已满足，须保持）。
- **偏好持久化走 `expo-sqlite/kv-store`**：用 `Storage` 的 `getItemSync` 首帧同步读以消除布局跳变；键名规范 `pref.<域>.<项>`；偏好独立于业务库、不进备份、不触发业务 schema 迁移。
- **语音复用 `media` 表与现有媒体管道**：`MediaItem.type` 放宽为 `'image' | 'video' | 'audio'`；不建新表、不另开媒体纵切；`thumbnail` 列对 audio 留空；CRUD/备份/级联删除/position 排序全部继承现有 media 逻辑。
- **Schema 演进近零成本**：`SCHEMA_VERSION 2→3`；`media.type` 是 TEXT 列，无需 `ALTER TABLE`，`MIGRATIONS[3]` 为空迁移仅登记版本。
- **备份版本白名单（旧备份兼容陷阱）**：现有校验为 `parsed.version !== 1 && parsed.version !== BACKUP_VERSION`；若把 `BACKUP_VERSION` 直接改 3 会拒绝所有 `version:2` 老备份。必须改为显式白名单 `SUPPORTED_BACKUP_VERSIONS = [1, 2, 3]`，并保留 v1/v2 解析路径。
- **iOS 麦克风权限前置**：语音功能落地前必须在 `app.json` 的 `expo.ios.infoPlist` 添加 `NSMicrophoneUsageDescription`（中文文案），录音前调用 `setAudioModeAsync({ allowsRecording: true })`，否则 iOS 录音崩溃。
- **既有代码约定固化**：DB 列名用 camelCase（非 snake_case）；时间戳用 `number` 毫秒（备份 manifest 用 ISO 除外）；Service 函数为具名 `async` 箭头 + 首行 `if (!db)` 守卫 + 批量写用 `withTransactionAsync`；颜色/字体一律走 `src/theme` token（改 `WordCloud.tsx` 时顺手把硬编码色值/字体迁移到 token）。

## Non-goals

- 不做语音转文字（STT）——语音只作为原声附件保存与播放。
- 不引入任何 AI 生成/推荐/情绪总结能力。
- 不引入网络层或云同步——保持完全本地。
- 不制造 streak/打卡等惩罚性游戏化压力（移除热力图正是为此）。
- 不引入分词第三方库；不引入自动化测试框架（现状无测试，超本次范围）。
- 不新建 `media` 表之外的媒体存储纵切；偏好数据不写入业务备份。

## Success signal

用户在同一次会话里完成一条无摩擦的记忆闭环：打开应用 3 秒内开始写字、录下一段原声、切成"随手记模式"看完这篇；回到回顾岛点一下词云里的"海边"，直接筛出那几篇；导出备份、换机后语音附件与手上的旧备份都完好导入——全程没有一次 AI 介入、没有一个 loading 遮挡、没有一条网络请求。可用一次端到端真机演示 + `npx tsc --noEmit` 通过共同判定。

## Assumptions

- 本 SPEC 覆盖 `epics.md` 全部 4 个 Epic / 9 个 FR，作为「下一阶段」单一里程碑蒸馏（用户已确认范围与 slug=`vivido-next`）。
- 推荐实现顺序沿用架构文档结论：Epic 1、2（零 ADR 依赖）先行 → Epic 3（须先建 ADR-1 偏好基元）→ Epic 4（最重，须先补 iOS 麦克风权限）。
- CAP-4 词云：本期仅做零依赖的停用词 + 词频/字长启发式规则；ADR-4 预留的本地词典方案裁定为后续可选增强，不在本期范围（用户确认 2026-07-07）。
- CAP-6 轮播：本期新建独立 `CarouselCard.tsx`（大图单焦点），与瀑布流 `TimelineCard` 分离，不复用同一组件（用户确认 2026-07-07）。
