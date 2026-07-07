---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-07-07'
inputDocuments:
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-06-16-00-00.md'
  - 'src/ (实际源码 — 唯一事实来源)'
project_name: 'Vivido'
user_name: '曾哭'
date: '2026-07-07'
sourceOfTruth: 'src/ 源码；docs/ 已过时，不作为依据'
---

# Vivido 架构决策文档

_本文档通过逐步协作式发现构建。各章节随我们共同完成每一项架构决策而追加。_

## 项目上下文分析

### 需求来源说明

本架构以 **头脑风暴 session**（`_bmad-output/brainstorming/brainstorming-session-2026-07-06-16-00-00.md`）为需求输入（充当 PRD），以 **`src/` 实际源码** 为架构现状的唯一事实来源。`docs/` 目录已过时，不作为依据。

### 功能需求（FRs）—— 按架构影响归类

7 个待实现功能，按其触及的架构层（而非脑暴的时间批次）重新归类，以暴露真正的架构决策点：

| 分组 | 功能 | 主要触及层 |
|------|------|-----------|
| **G1 · Discovery 重构** | 移除热力图、词云可点击筛选、词云算法优化 | Hook (`useDiscovery`)、Service (`getWordFrequency`/`getHeatmapData`)、组件 |
| **G2 · 交互摩擦优化** | 3 秒进入写作、时间分隔线 | 导航 (`App.tsx`/初始化)、Screen (`Editor`/`Home`) |
| **G3 · 呈现层可选性** | 首页双布局（瀑布流+轮播）、双模式详情页 | Screen (`Home`/`Detail`) + 新的偏好持久化基元 |
| **G4 · 新媒体类型** | 语音附件（原声） | 贯穿全栈：types → database(schema v3) → storage → backup → 编辑/浏览组件 |

### 非功能需求（NFRs）与硬约束

| NFR | 架构含义 |
|-----|---------|
| **无 AI 原则** | 词云"智能化"必须走本地规则/词典路线，绝不引入模型调用。硬边界。 |
| **完全本地** | 无网络层、无云同步。所有能力围绕 SQLite + 文件沙盒。 |
| **3 秒进入写作** | 性能指标：审查启动链路（字体加载、DB init、导航），消除进入 Editor 前的弹窗/loading。 |
| **克制极简** | 架构上倾向删代码 > 加代码；不为可选性引入重型状态库。 |
| **不惩罚简短** | 数据模型必须容忍空标题、空媒体、极短正文（现状已满足，需保持）。 |
| **备份向后兼容** | 语音附件升 `SCHEMA_VERSION` 2→3 + `BACKUP_VERSION` 演进，旧备份必须仍可导入。 |

### 现状架构盘点（基于真实代码）

- **分层清晰**：Screens(5) / Components(16) / Hooks / Utils / Services(database·storage·backup) / expo 原生层
- **无全局状态库**：靠 `useFocusEffect` 每次聚焦重拉；SQLite 是唯一真相源
- **迁移框架已就位**：`ensureSchemaVersion()` + `MIGRATIONS` 记录表，具备升 v3 的基础
- **备份已用原生 ZIP**：`react-native-zip-archive` + 暂存目录（媒体字节不进 JS 堆），格式 v2 含 `schemaVersion` 校验，`parseBackupManifest` 已兼容 v1/v2 多版本解析
- **`expo-audio ~55.0.14` 已安装但未使用** —— 语音附件的依赖已就绪
- **词云现状**：`getWordFrequency` 为字符级 bigram 提取 + 停用词 Set，非真正分词

### 跨领域关注点（Cross-Cutting）—— 本次架构的核心

4 个功能背后收敛为 **4 个可独立拍板的架构决策**（经 ADR 深挖，将语音的「契约」与「迁移/备份」拆分为两个独立决策）：

1. **🔑 偏好持久化基元（新增）** —— 双布局切换 + 双模式详情页都需要「记住用户选择」。项目当前没有任何轻量持久化机制。这是必须新建的基元，且会成为未来所有"设置项"的落点。
   - _初步倾向（待 Step 4 版本核对）_：**复用已安装的 `expo-sqlite/kv-store`（Storage API），零新增依赖**。经比较分析矩阵（启动性能/克制度/维护/正确性/扩展 加权）翻案：它同时满足两个看似冲突的约束——(a) 零新增依赖（复用 expo-sqlite，胜过引入 AsyncStorage）；(b) 提供**同步读** `getItemSync`，首帧即可拿到布局偏好，消除"先渲染默认布局再跳变"，不违背"无 loading"。且独立于业务 `diaries`/`media` 表，不进备份、不触发业务 schema 迁移。

2. **🔑 语音媒体类型契约** —— `MediaItem.type` 从 `'image'|'video'` → 加 `'audio'`，是贯穿 types/database/storage/backup/组件的纵切。
   - _初步倾向（待正式决策）_：**复用 `media` 表，`type='audio'`，继承现有媒体管道**。真正的新增只有两处：录音采集（storage）+ 播放组件（UI）。数据/备份/删除逻辑继承现有媒体管道，改动是"放宽联合类型"而非"新增子系统"。

3. **🔑 Schema v3 与 Backup 协同演进** —— 升 `SCHEMA_VERSION 2→3` 与 `BACKUP_VERSION` 如何不丢数据、不废旧备份。
   - _初步倾向（待正式决策）_：v3 是**近零成本 schema 升级**（`media.type` 是 TEXT 列，天然容纳新 type，无需 ALTER TABLE）；但 **`BACKUP_VERSION` 必须升级 2→3 并放宽 `parseBackupManifest` 的 type 校验**（否则旧解析器会拒绝 `type='audio'`）；保留 v1/v2 解析路径以导入旧备份。

4. **中文文本处理策略** —— 词云优化是独立的纯算法关注点（本地词典/词性表），不污染其他层。

### 规模评估

- **主域**：移动端（React Native / Expo）单机本地应用
- **复杂度**：**中等**。无实时、无多租户、无网络、无合规负担；复杂度集中在 G4 语音附件的全栈纵切 与 G3 偏好持久化基元的引入。
- **架构风险排序**：G4（高）> G3（中）> G1/G2（低）

## 技术基线评估

### 主技术域

移动端本地应用（Expo SDK 55 / React Native 0.83）——**现有项目，非新建**，故本步为「确认既定基线」而非「选脚手架」。

### 既定技术基线（约束）

| 维度 | 现状 | 决策含义 |
|------|------|---------|
| **框架** | Expo SDK 55 + React Native 0.83 | 已装 `expo-dev-client`，支持原生模块 |
| **语言** | TypeScript strict | 所有新代码遵循 strict |
| **导航** | React Navigation 7 native-stack | 新页面/模式沿用同一 Navigator |
| **数据库** | expo-sqlite（`SCHEMA_VERSION=2`，迁移框架就位） | v3 迁移填入既有 `MIGRATIONS` |
| **媒体** | expo-image-picker / expo-image / expo-video / **expo-audio(已装未用)** | 语音走 expo-audio |
| **文件/备份** | expo-file-system + **react-native-zip-archive**（原生 ZIP） | 备份走原生流式 ZIP，非 JSZip |
| **持久化(UI偏好)** | 当前缺失 | 新增 → 复用 `expo-sqlite/kv-store`（见 ADR-1） |
| **状态管理** | 无全局库，`useFocusEffect` 重拉 | 保持，不引入 Redux/Zustand |
| **字体** | PlayfairDisplay / LXGWWenKaiLite / SmileySans | 沿用 theme token |

### 结论：零新增依赖

Vivido 全部 7 个功能可在**现有技术栈上零新增依赖完成**——完美契合「克制极简」原则。两个原以为需新依赖的点均被证伪：

1. **偏好持久化 → 零新增依赖**：复用已安装的 `expo-sqlite/kv-store`（Storage API），提供同步读 `getItemSync`，见 ADR-1。（版本细节待 Step 4 正式决策时联网核对。）
2. **语音附件 → 零新增依赖**：见下「语音附件技术核验」。

### 语音附件技术核验（本地权威证据）

对 `node_modules/expo-audio` 类型定义 + `app.json` 交叉核验：

| 事实 | 结论 | 证据 |
|------|------|------|
| 录音+播放能力 | ✅ 同一包 | `useAudioRecorder`/`AudioRecorder` + `useAudioPlayer`/`AudioPlayer` |
| SDK 55 API 形态 | ✅ 新 hooks API | `useAudioRecorder(RecordingPresets.HIGH_QUALITY)` → `prepareToRecordAsync()` → `record()` → `stop()` → `recorder.uri` |
| Android 权限 | ✅ 已配置 | `app.json` 含 `RECORD_AUDIO`/`MODIFY_AUDIO_SETTINGS`/`FOREGROUND_SERVICE(_MEDIA_PLAYBACK)` + `expo-audio` 插件已注册 |
| 录音格式 | ✅ 跨端统一 **m4a** | `RecordingPresets` 默认 `extension:'.m4a'`（iOS AAC / Android mpeg4-aac），mimeType `audio/mp4` |
| 权限 API | ✅ 有 | `requestRecordingPermissionsAsync` / `getRecordingPermissionsAsync` |

**⚠️ 待 Step 4 落地时必须补的缺口：**

- **iOS `NSMicrophoneUsageDescription` 缺失**（`app.json` → `ios.infoPlist`）——iOS 录音无此描述会**崩溃**。Android 已齐，iOS 漏。
- 录音前需 `setAudioModeAsync({ allowsRecording: true })`。

**语音必做的 4 个边界防护**（其余场景由现有 media 管道继承覆盖）：

| # | 场景 | 防护 |
|---|------|------|
| E1 | 0 秒/空录音 | 停录后校验时长>阈值 且 文件 size>0，否则丢弃不入库 |
| E3 | 录音被来电/闹钟打断 | 监听 recording status + `interruptionMode`，中断即 stop 保存已录部分 |
| E4 | 权限被拒 | 入口前 `getRecordingPermissionsAsync` 检查，拒绝则引导设置，不崩 |
| E5 | iOS 缺麦克风描述 | 补 `NSMicrophoneUsageDescription`（见上） |

> 备份健壮性（导入缺失音频报错、导出单文件失败汇总）由现有 `media` 管道**继承覆盖**，audio 零新增风险。

### 备注

现有技术栈满足全部 7 个功能需求，无需更换或重大升级。**新增依赖数：0**。项目初始化非本次范围（现有项目）。

## 核心架构决策

### 决策优先级

| 层级 | 决策 |
|------|------|
| **Critical（阻塞实现）** | ADR-1 偏好持久化基元、ADR-2 语音媒体契约、ADR-3 Schema/Backup 演进 |
| **Important（塑造架构）** | ADR-4 中文词云算法策略、G1–G3 各功能落地模式 |
| **已定（不再议）** | 技术栈基线、零新增依赖、无 AI、无全局状态库 |

### ADR-1：偏好持久化基元（事实已用本地 node_modules 验证）

| 项 | 决策 |
|----|------|
| **决策** | 复用 `expo-sqlite/kv-store` 的 `Storage`（默认实例），封装 `usePreference<T>` hook |
| **导入** | `import { Storage } from 'expo-sqlite/kv-store'`（package.json subpath export 已确认） |
| **同步读** | `Storage.getItemSync(key)` 首帧同步取值 → 消除布局跳变，不违背"无 loading" |
| **版本** | expo-sqlite@55.0.15（已装），**零新增依赖** |
| **隔离** | kv-store 用独立 db 文件，不碰 `diaries`/`media` 表、不进备份、不触发业务 schema 迁移 |
| **影响** | 新增 `src/hooks/usePreference.ts` + `src/services/preferences.ts`（薄封装）；G3 双布局、双详情模式落于此 |
| **键规范** | `pref.home.layout` = `'timeline' \| 'carousel'`；`pref.detail.mode` = `'refined' \| 'quick'` |

> `Storage.d.ts` 已确认导出 `SQLiteStorage`（含 `getItemSync`/`setItemSync`/`getItemAsync` 等），`Storage` 与 `AsyncStorage` 均为默认实例。

### ADR-2：语音媒体类型契约（事实已验证）

| 项 | 决策 |
|----|------|
| **决策** | `MediaItem.type` 联合类型放宽为 `'image' \| 'video' \| 'audio'`；**复用 `media` 表**，不建新表 |
| **落盘** | 录音 `recorder.uri`（m4a）→ `storage.saveMedia()` 复制到 `documentDirectory/media/`，与图片/视频同管道 |
| **`thumbnail` 列** | audio 留空（不语义污染）；未来若需时长另加列 |
| **格式** | 跨端统一 `.m4a`（`RecordingPresets`），mimeType `audio/mp4` |
| **新增面** | 仅两处：① `storage` 录音采集封装；② UI 新增录制入口组件 + 播放组件 |
| **继承面** | DB CRUD、备份导入导出、级联删除、position 排序全部继承现有 media 逻辑 |

### ADR-3：Schema v3 与 Backup 协同演进（事实已验证）

| 项 | 决策 |
|----|------|
| **Schema v3** | `SCHEMA_VERSION 2→3`；`media.type` 是 TEXT 列，**无需 ALTER TABLE**，`MIGRATIONS[3]` 为空迁移（仅登记版本，标记支持 audio） |
| **Backup 版本** | `BACKUP_VERSION 2→3`；放宽 `parseBackupManifest` 的 media type 校验，接受 `'audio'` |
| **⚠️ 强制约束（旧备份兼容陷阱）** | 现有校验 `parsed.version !== 1 && parsed.version !== BACKUP_VERSION`（backup.ts:98-101）只接受「1 或当前版本」。若把 `BACKUP_VERSION` 直接改 3，会**拒绝所有 `version:2` 老备份**（报 `Unsupported backup format`）。**必须改为显式白名单** `const SUPPORTED_BACKUP_VERSIONS = [1, 2, 3]; if (!SUPPORTED_BACKUP_VERSIONS.includes(parsed.version) ...)`，否则用户现有备份无法导入 |
| **向后兼容** | 保留 v1/v2 解析路径（现有代码已具此模式），旧备份仍可导入。`schemaVersion` 校验（老 2 ≤ 新 3）与 `appVersion` 校验对老备份天然放行 |
| **mimeType 映射** | 导出时 audio → `audio/mp4`；导入时按扩展名 `.m4a` 回推 |
| **iOS 缺口** | ⚠️ 落地前必补 `app.json` → `ios.infoPlist.NSMicrophoneUsageDescription` |

### ADR-4：中文词云算法策略

| 项 | 决策 |
|----|------|
| **决策** | 本地规则升级：扩充停用词表 + 基于词频/字长启发式优先双字/三字词，**不引入分词库**（避免新依赖 + 契合无 AI） |
| **可选增强** | 若效果不足，评估纯本地词典方案，但默认先用零依赖规则，作为独立算法关注点迭代。**（决策 2026-07-07：本期仅做零依赖规则，本地词典方案不入本期范围，留作后续可选增强。）** |
| **可点击筛选** | 词云词 → 复用 `useDiscovery` 的 `setSearchQuery`，静态可视化变导航入口（零架构新增） |

### 7 个功能 → 决策映射（落地锚点）

| 功能 | 依赖决策 | 落地层 | 风险 |
|------|---------|--------|------|
| 移除热力图 | — | `useDiscovery` 删 `getHeatmapData` 调用 + 删 `ActivityHeatmap` 组件 | 极低 |
| 时间分隔线 | — | `HomeScreen` FlatList 分组渲染（纯 UI） | 低 |
| 词云可点击筛选 | ADR-4 | `WordCloud` 组件加 onPress → useDiscovery | 低 |
| 词云算法优化 | ADR-4 | `getWordFrequency` 算法层 | 中 |
| 3 秒进入写作 | — | 审 `App.tsx` init 链路 + Editor 导航，去 loading/弹窗 | 低 |
| 首页双布局 | **ADR-1** | `HomeScreen` + 新 carousel 布局 + `usePreference` | 中 |
| 双模式详情页 | **ADR-1** | `DetailScreen` 两套渲染 + `usePreference` | 中 |
| 语音附件 | **ADR-2/3** | 全栈纵切（types→db→storage→backup→组件） | 高 |

### 决策影响分析

**实现顺序（呼应脑暴三批 + 依赖关系）：**

1. 第一批（零 ADR 依赖）：移除热力图 → 时间分隔线 → 词云可点击筛选
2. 第二批（引入 ADR-1 + ADR-4）：词云算法优化 → 3 秒进入写作 → **ADR-1 落地** → 首页双布局 + 双模式详情页
3. 第三批（ADR-2/3 全栈纵切）：语音附件（独立里程碑）

**跨组件依赖：**

- ADR-1 是 G3 两个功能的共同前置，须先建 `usePreference` 基元
- ADR-2 与 ADR-3 成对：媒体契约放宽必须同步 backup 版本递增，否则旧解析器拒绝 audio
- 语音里程碑前置：补 iOS 麦克风 infoPlist（否则 iOS 崩溃）

## 实现模式与一致性规则

本项目是**现有代码库**，一致性的最大威胁不是"多个 agent 各写各的"，而是**新代码偏离既有约定**。以下规则 = 既有约定的显式化 + 4 个 ADR 的新增约定，均从真实源码提取。

### 一、命名约定（从源码提取）

| 类别 | 约定 | 证据 |
|------|------|------|
| DB 表名 | 复数小写：`diaries`/`media`/`tags`/`diary_tags`/`drafts` | database.ts |
| DB 列名 | **camelCase**：`createdAt`/`diaryId`/`updatedAt`（⚠️ 非 snake_case） | database.ts |
| 关联表 | `a_b` 下划线：`diary_tags` | database.ts |
| 索引名 | `idx_<表>_<列>`：`idx_diaries_createdAt` | database.ts |
| 组件文件 | PascalCase：`WordCloud.tsx`/`TimelineCard.tsx` | src/components |
| 服务/hook/util 文件 | camelCase：`database.ts`/`useDiscovery.ts`/`date.ts` | src/ |
| 函数 | camelCase 动词开头：`getDiariesPaginated`/`saveMedia` | 全局 |
| Service 导出 | 全部 `export const fn = async () => {}` 具名箭头函数 | database.ts/storage.ts |

### 二、结构约定

| 类别 | 约定 |
|------|------|
| 分层落点 | UI→`screens/`+`components/`；逻辑→`hooks/`+`utils/`；数据→`services/`。新代码必须归入对应层 |
| 组件导出 | 具名导出 + `components/index.ts` 汇总（barrel） |
| 无测试目录 | 项目当前无测试；不擅自引入测试框架（超范围） |
| 新增基元落点 | ADR-1 → `src/hooks/usePreference.ts` + `src/services/preferences.ts`；ADR-2 音频 → `src/components/AudioRecorder.tsx` + `AudioPlayer.tsx` |

### 三、格式约定

| 类别 | 约定 | 证据 |
|------|------|------|
| 时间戳 | `number`（`Date.now()` 毫秒），**非 ISO**；仅备份 manifest 用 ISO | DiaryEntry.createdAt |
| JSON 序列化 | 草稿的 media/tags 存 `JSON.stringify` 字符串列 | drafts 表 |
| ID 生成 | `generateId()`（`utils/uuid`），字符串主键 | 全局 |
| 枚举值 | 字符串字面量联合类型：`'image'\|'video'` → 加 `'audio'` | types |
| 偏好键（新） | `pref.<域>.<项>`：`pref.home.layout`/`pref.detail.mode` | 本次新增 |

### 四、状态与数据流约定

| 类别 | 约定 |
|------|------|
| 无全局状态库 | 禁止引入 Redux/Zustand/Context 做数据流；SQLite 是唯一真相源 |
| 数据刷新 | 页面用 `useFocusEffect` 聚焦重拉；不做手动缓存 |
| 偏好读取（新） | 用 `Storage.getItemSync` 首帧同步读（防跳变），写用 async；封装进 `usePreference` |
| 参数传递 | 屏幕间只传 id（`diaryId`），不传整个对象 | 

### 五、过程约定（错误/加载）

| 类别 | 约定 | 证据 |
|------|------|------|
| DB 未初始化 | 每个 service 函数首行 `if (!db) throw new Error('Database not initialized')` | database.ts |
| 文件删除容错 | try/catch + `console.warn`，删除失败不阻断 | storage.ts |
| 批量 DB 写 | 用 `db.withTransactionAsync` 包裹（create/update/replace） | database.ts |
| 备份错误 | 自定义 Error 类（`BackupCancelledError` 等）+ 失败文件汇总 | backup.ts |
| 加载态 | 局部 `isLoading` state；**但进入 Editor 路径禁止 loading**（3秒原则） | useDiscovery |

### 六、主题约定 + 发现的债务

| 类别 | 约定 |
|------|------|
| 颜色/字体 | **必须**用 `src/theme` token，禁止硬编码色值 |
| ⚠️ 既有债务 | `WordCloud.tsx` 硬编码了 `#a89080`/`#c47030`/`#3d2c1e` 与 `fontFamily:'LXGWWenKaiLite'`——违反主题约定。改词云时应顺手迁移到 theme token |
| ✅ 意外发现 | `WordCloud` 已有 `onWordPress` prop + TouchableOpacity——「词云可点击筛选」组件侧已部分就绪，只需在 DiscoveryScreen 接线到 `setSearchQuery` |

### 强制规则（所有实现必须遵守）

1. **DB 列名用 camelCase**（跟随现有，勿引入 snake_case）
2. **时间戳用 number 毫秒**，不用 ISO（备份 manifest 除外）
3. **不引入任何新依赖、不引入全局状态库、不引入 AI**
4. **颜色/字体走 theme token**，改动旧组件时顺手还债
5. **audio 复用 media 表与管道**，不建新表、不建新纵切
6. **偏好走 `expo-sqlite/kv-store`**，键名 `pref.<域>.<项>`，同步读
7. **Service 函数**：具名 async 箭头 + `if(!db)` 守卫 + 批量写用事务

## 项目结构与边界

### 现有结构 + 本次变更标注

图例：🟢 新增 | 🟡 修改 | 🔴 删除 | ⚪ 不变

```
Vivido/
├── app.json                          🟡 补 ios.infoPlist.NSMicrophoneUsageDescription
├── App.tsx                           🟡 审查 init 链路（3秒进入写作）
├── package.json                      ⚪ 零新增依赖
├── src/
│   ├── types/index.ts                🟡 MediaItem.type 加 'audio'；偏好键类型
│   ├── theme/index.ts                ⚪
│   ├── constants.ts                  ⚪ APP_VERSION（发版时改）
│   ├── services/
│   │   ├── database.ts               🟡 SCHEMA_VERSION 2→3；MIGRATIONS[3]={}；getWordFrequency 优化
│   │   ├── storage.ts                🟡 加录音落盘（复用 saveMedia 管道）
│   │   ├── backup.ts                 🟡 BACKUP_VERSION 2→3；版本白名单[1,2,3]；audio mime 映射
│   │   └── preferences.ts            🟢 kv-store 薄封装（Storage getItemSync/setItemAsync）
│   ├── hooks/
│   │   ├── useDiscovery.ts           🟡 移除 heatmap 数据流
│   │   └── usePreference.ts          🟢 泛型偏好 hook（同步首帧读 + 写）
│   ├── screens/
│   │   ├── HomeScreen.tsx            🟡 时间分隔线 + 双布局切换
│   │   ├── DetailScreen.tsx          🟡 双模式渲染（refined/quick）
│   │   ├── EditorScreen.tsx          🟡 集成录音入口；进入路径去 loading
│   │   ├── DiscoveryScreen.tsx       🟡 删热力图 UI；词云 onPress 接 setSearchQuery
│   │   └── SettingsScreen.tsx        ⚪
│   ├── components/
│   │   ├── ActivityHeatmap.tsx       🔴 删除
│   │   ├── WordCloud.tsx             🟡 硬编码色值→theme token（onWordPress 已就绪）
│   │   ├── AudioRecorder.tsx         🟢 录音入口（useAudioRecorder）
│   │   ├── AudioPlayer.tsx           🟢 播放（useAudioPlayer）
│   │   ├── MediaPicker.tsx           🟡 加"录音"入口，与图片/视频平级
│   │   ├── MediaViewer/FullScreenGallery  🟡 audio 分支渲染 AudioPlayer
│   │   ├── TimelineCard.tsx          🟡 audio 角标
│   │   ├── CarouselCard.tsx          🟢 新建：轮播大图单焦点卡片（决策 2026-07-07，独立组件不复用 TimelineCard）
│   │   └── index.ts                  🟡 barrel 增删导出
│   └── utils/
│       ├── media.ts                  🟡 支持 .m4a 扩展名
│       ├── date.ts                   ⚪
│       └── uuid.ts                   ⚪
```

### 架构边界

| 边界 | 规则 |
|------|------|
| 偏好 vs 业务数据 | 偏好走 `preferences.ts`→kv-store 独立 db；业务走 `database.ts`→diary.db。两者不交叉，**备份只含后者** |
| 媒体管道单入口 | 所有媒体（含 audio）经 `storage.saveMedia` 落盘、`media` 表建模、backup media 逻辑导出。audio 不得另开管道 |
| UI ↔ 数据 | 屏幕只经 hooks/services 取数，不直接开 SQLite；只传 `diaryId` |
| 算法隔离 | 词云分词收敛在 `getWordFrequency`（或抽 `utils/wordcloud.ts`），不外溢到组件 |

### 需求 → 文件落点映射

| 功能 | 主改文件 |
|------|---------|
| 移除热力图 | `useDiscovery.ts` + `DiscoveryScreen.tsx` + 删 `ActivityHeatmap.tsx` |
| 时间分隔线 | `HomeScreen.tsx` + `utils/date.ts` |
| 词云可点击 | `DiscoveryScreen.tsx`（组件已就绪） |
| 词云算法 | `database.ts:getWordFrequency`（或抽 `utils/wordcloud.ts`） |
| 3秒进入写作 | `App.tsx` + `EditorScreen.tsx` |
| 首页双布局 | `HomeScreen.tsx` + `usePreference.ts` + `preferences.ts` + `CarouselCard.tsx`（新建） |
| 双模式详情 | `DetailScreen.tsx` + `usePreference.ts` |
| 语音附件 | types+database+storage+backup+app.json+AudioRecorder/Player+MediaPicker |

### 变更规模小结

- **新增文件**：5 个（`preferences.ts`, `usePreference.ts`, `AudioRecorder.tsx`, `AudioPlayer.tsx`, `CarouselCard.tsx`）+ 可选 `utils/wordcloud.ts`（词云逻辑抽取时）
- **删除文件**：1 个（`ActivityHeatmap.tsx`）
- **修改文件**：约 12 个
- **新增依赖**：0

## 架构验证结果

### 一致性验证 ✅

| 检查 | 结论 |
|------|------|
| 决策相容性 | 4 个 ADR 互不冲突：ADR-1(偏好隔离) 与 ADR-2/3(媒体) 走完全不同存储路径；ADR-4 纯算法层无耦合 |
| 技术版本相容 | 零新增依赖 → 无版本冲突。基于已装包（expo-sqlite@55.0.15 kv-store、expo-audio@55.0.14），本地 `.d.ts` 核实 |
| 模式↔决策对齐 | 强制规则 5/6 条直接支撑 ADR-1/2；camelCase 列名与现有 schema 一致 |
| 结构↔边界对齐 | 「偏好 vs 业务数据」「媒体单入口」边界在目录结构有明确落点 |

### 需求覆盖验证 ✅

全部 7 功能 + 5 产品原则均有架构支撑；NFR（3秒进入写作、完全本地、备份兼容）均已处理。

### 实现就绪验证 ✅

决策完整（4 ADR 含证据/影响/版本）、结构完整（带变更标注的目录树 + 需求映射）、模式完整（6 类约定 + 7 条强制规则）。

### 缺口分析

| 优先级 | 缺口 | 处置 |
|--------|------|------|
| Critical | 无阻塞性缺口 | — |
| Important | iOS `NSMicrophoneUsageDescription` 未落地 | 已作语音里程碑前置约束（实现清单项，非架构缺口） |
| Important | 备份版本白名单陷阱 | 已作 ADR-3 强制约束固化 |
| Nice-to-have | 词云规则不足时需词典 | ADR-4 已留可选增强路径 |
| Nice-to-have | 无自动化测试 | 现状无测试，本次不引入（超范围） |

### 架构完整性检查清单

**需求分析**
- [x] 项目上下文充分分析
- [x] 规模与复杂度评估
- [x] 技术约束识别
- [x] 跨领域关注点映射

**架构决策**
- [x] 关键决策含版本记录
- [x] 技术栈完全指定
- [x] 集成模式定义
- [x] 性能考量已处理（3秒原则）

**实现模式**
- [x] 命名约定确立
- [x] 结构模式定义
- [x] 通信/数据流模式指定
- [x] 过程模式（错误/加载）文档化

**项目结构**
- [x] 完整目录结构定义
- [x] 组件边界确立
- [x] 集成点映射
- [x] 需求→结构映射完成

### 架构就绪评估

**总体状态：** ✅ **READY FOR IMPLEMENTATION**（16 项全部勾选，无 Critical 缺口）

**信心等级：** **高**——所有 load-bearing 事实（kv-store 同步 API、expo-audio 录音+播放、app.json 权限、备份版本校验逻辑、schema TEXT 列）均用本地源码/类型定义直接核实。

**关键优势：**
1. 零新增依赖，最大化契合克制原则
2. 语音复用现有 media 管道，纵切爆炸面收敛到最小
3. 每个决策有真实代码证据背书
4. 提前捕获两个会翻车的坑（iOS 麦克风崩溃、备份版本白名单）

**未来增强方向：** 自动化测试、词云词典方案、脑暴中未展开的品牌方向（反云绑架/浪漫迁移/时间旅行回顾）

### 实现交接

**AI Agent 指引：** 严格遵循 4 ADR 与 7 条强制规则；audio 复用 media 管道不另开纵切；偏好走 kv-store 不进备份；改旧组件顺手还主题债。

**首要实现优先级：** 第一批（零 ADR 依赖）——① 移除热力图 → ② 时间分隔线 → ③ 词云可点击筛选（组件侧已就绪，最快见效）。
