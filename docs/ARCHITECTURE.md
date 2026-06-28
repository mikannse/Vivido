# 系统架构

## 整体架构

Vivido 采用经典的 React Native 分层架构，所有业务逻辑集中在 `src/` 目录，数据持久化使用本地 SQLite，媒体文件存储在应用沙盒目录。

```
┌─────────────────────────────────────────────┐
│                 UI 层                        │
│  Screens (5) + Components (16)              │
│  Theme (Typography + Colors)                │
├─────────────────────────────────────────────┤
│              业务逻辑层                      │
│  Hooks (useDiscovery)                       │
│  Utils (uuid, date, media)                  │
├─────────────────────────────────────────────┤
│              服务层                          │
│  database.ts (SQLite CRUD)                  │
│  storage.ts (文件系统 I/O)                  │
│  backup.ts (ZIP 导出/导入)                  │
├─────────────────────────────────────────────┤
│              原生能力层                      │
│  expo-sqlite, expo-file-system              │
│  expo-image-picker, expo-image, expo-video  │
│  expo-sharing, expo-document-picker         │
└─────────────────────────────────────────────┘
```

## 导航结构

使用 React Navigation 7 Native Stack Navigator，共 5 个页面：

| 页面 | 路由名 | 参数 | 说明 |
|------|--------|------|------|
| 主页 | `Home` | - | 时间轴列表，支持分页加载 |
| 编辑器 | `Editor` | `diaryId?: string` | `undefined` 为新建，有值则为编辑 |
| 详情 | `Detail` | `diaryId: string` | 查看单篇日记，支持前后导航 |
| 设置 | `Settings` | - | 备份、恢复、关于 |
| 回顾岛 | `Discovery` | - | 搜索、筛选、热力图、词云 |

编辑器页面使用 `presentation: 'modal'` 以模态方式呈现。

## 数据流

### 1. 应用初始化

`App.tsx` 在 `useEffect` 中依次执行：
1. 加载 3 款自定义字体（`expo-font`）
2. 调用 `initDatabase()` 打开 SQLite 并创建表
3. 若初始化失败，显示重试界面

### 2. 页面数据获取

各页面不使用全局状态库，而是通过 `useFocusEffect` 在获得焦点时主动拉取数据：

- **HomeScreen**：调用 `getDiariesPaginated(limit, offset)`，每页 20 条
- **EditorScreen**：根据 `diaryId` 调用 `getDiaryById()` 或 `getDraft()`
- **DetailScreen**：调用 `getDiaryById()` 和 `getAdjacentDiaryIds()`
- **DiscoveryScreen**：通过 `useDiscovery` Hook 聚合搜索、标签、热力图、词云数据

### 3. 媒体处理管道

```
expo-image-picker (多选)
    │
    ▼
storage.saveMedia(sourceUri, fileName)
    │  复制到 documentDirectory/media/
    ▼
SQLite media 表记录 uri、thumbnail、position
    │
    ▼
各组件通过 uri 渲染（expo-image / expo-video）
```

视频缩略图不在保存时生成，而是在 `VideoPoster` 组件中通过 `expo-video` 的 `generateThumbnailsAsync` 按需生成。

### 4. 草稿自动保存

`EditorScreen` 每 2 秒（debounce）调用 `saveDraft()`，将标题、正文、媒体（JSON）、标签（JSON）序列化后存入 `drafts` 表。草稿在以下场景被清除：
- 用户成功保存日记
- 用户主动放弃编辑并确认

## 数据库 Schema

```sql
-- 日记主表
CREATE TABLE diaries (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

-- 媒体附件表
CREATE TABLE media (
  id TEXT PRIMARY KEY NOT NULL,
  diaryId TEXT NOT NULL,
  type TEXT NOT NULL,          -- 'image' | 'video'
  uri TEXT NOT NULL,
  thumbnail TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (diaryId) REFERENCES diaries(id) ON DELETE CASCADE
);

-- 标签表
CREATE TABLE tags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#c47030',
  createdAt INTEGER NOT NULL
);

-- 日记-标签关联表
CREATE TABLE diary_tags (
  diaryId TEXT NOT NULL,
  tagId TEXT NOT NULL,
  PRIMARY KEY (diaryId, tagId),
  FOREIGN KEY (diaryId) REFERENCES diaries(id) ON DELETE CASCADE,
  FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
);

-- 草稿表
CREATE TABLE drafts (
  id TEXT PRIMARY KEY NOT NULL,
  diaryId TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  date TEXT NOT NULL,
  media TEXT NOT NULL,         -- JSON
  tags TEXT NOT NULL,          -- JSON
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (diaryId) REFERENCES diaries(id) ON DELETE CASCADE
);

-- 版本迁移记录
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  description TEXT,
  appliedAt INTEGER NOT NULL
);
```

### 索引

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `idx_diaries_createdAt` | `createdAt DESC` | 时间轴排序 |
| `idx_media_diaryId` | `diaryId` | 关联查询 |
| `idx_drafts_diaryId` | `diaryId` | 草稿关联查询 |
| `idx_drafts_updatedAt` | `updatedAt DESC` | 草稿列表排序 |

## 组件层级

```
App.tsx
├── ErrorBoundary
└── SafeAreaProvider
    └── NavigationContainer
        ├── Stack.Navigator
        │   ├── HomeScreen
        │   │   └── FlatList
        │   │       └── TimelineCard (列表项)
        │   ├── EditorScreen (modal)
        │   │   ├── DatePickerModal
        │   │   ├── MediaPicker
        │   │   ├── TagEditor
        │   │   │   └── TagChip
        │   │   └── StyledDialog (放弃/保存确认)
        │   ├── DetailScreen
        │   │   ├── FullScreenGallery (媒体浏览)
        │   │   │   └── VideoPoster
        │   │   ├── DiaryContent (正文渲染)
        │   │   └── StyledDialog (删除确认)
        │   ├── DiscoveryScreen
        │   │   ├── FilterChips
        │   │   ├── ActivityHeatmap
        │   │   ├── WordCloud
        │   │   └── EmptyDiscovery
        │   └── SettingsScreen
        │       └── StyledDialog
        └── StatusBar
```

## 主题系统

主题文件：`src/theme/index.ts`

### 字体

| Token | 字体文件 | 用途 |
|-------|----------|------|
| `typography.title` | SmileySans-Oblique | 日记标题 |
| `typography.body` | LXGWWenKaiLite-Regular | 正文、UI 文字 |
| `typography.appName` | PlayfairDisplay-VariableFont_wght | 应用名、大日期 |

### 颜色

| Token | 色值 | 用途 |
|-------|------|------|
| `background` | `#f8f6f3` | 页面背景 |
| `surface` | `#fdfcfb` | 卡片背景 |
| `primary` | `#c47030` | 品牌色（按钮、高亮） |
| `text` | `#3d2c1e` | 主文字（深棕） |
| `textSecondary` | `#827066` | 次要文字 |
| `border` | `#e2ddd8` | 分割线、边框 |

## 状态管理策略

本项目**不引入 Redux / Zustand / Context** 等全局状态库，原因：
- 应用规模较小，页面间数据传递简单
- SQLite 是唯一的真实数据源
- `useFocusEffect` 保证每次进入页面数据都是最新的

唯一复杂的局部状态在 `useDiscovery.ts` 中，它协调了：
- 搜索词（debounce 300ms）
- 时间筛选（week / month / all）
- 日期/月份精准筛选
- 标签多选（OR 逻辑）
- 热力图与词云的并行请求
