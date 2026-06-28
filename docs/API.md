# API 文档

## 类型定义

文件：`src/types/index.ts`

```typescript
export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  uri: string;
  thumbnail?: string;
  fileName?: string | null;
  mimeType?: string | null;
  position?: number;
}

export interface DiaryEntry {
  id: string;
  title: string;
  content: string;
  media: MediaItem[];
  tags: Tag[];
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export type TimeFilter = 'week' | 'month' | 'all';

export type RootStackParamList = {
  Home: undefined;
  Editor: { diaryId?: string };
  Detail: { diaryId: string };
  Settings: undefined;
  Discovery: undefined;
};
```

---

## 数据库服务

文件：`src/services/database.ts`

### 初始化

```typescript
export const initDatabase = async (): Promise<void>
export const getSchemaVersion = async (): Promise<number>
```

`initDatabase` 打开 `diary.db`，创建所有表、索引，并执行迁移。

### 日记 CRUD

```typescript
// 创建日记（事务包裹）
export const createDiary = async (entry: DiaryEntry): Promise<void>

// 更新日记（事务包裹，先删后插 media 和 tags）
export const updateDiary = async (entry: DiaryEntry): Promise<void>

// 删除日记（级联删除 media、diary_tags）
export const deleteDiary = async (id: string): Promise<void>

// 获取单篇日记（含 media、tags）
export const getDiaryById = async (id: string): Promise<DiaryEntry | null>

// 获取所有日记（时间倒序）
export const getAllDiaries = async (): Promise<DiaryEntry[]>

// 分页获取（列表性能优化，每篇日记只取前 3 条 media）
export const getDiariesPaginated = async (
  limit: number,
  offset: number,
  mediaLimitPerDiary?: number
): Promise<{ diaries: DiaryEntry[]; total: number }>

// 获取相邻日记 ID（用于详情页前后导航）
export const getAdjacentDiaryIds = async (
  diaryId: string
): Promise<{ prevId: string | null; nextId: string | null }>
```

### 搜索与筛选

```typescript
export const searchDiaries = async (
  query: string,
  tagIds: string[],
  timeFilter: TimeFilter,
  selectedDate?: string | null,
  monthFilter?: MonthFilter | null
): Promise<DiaryEntry[]>
```

### 标签管理

```typescript
export const createTag = async (name: string, color?: string): Promise<Tag>
export const getAllTags = async (): Promise<Tag[]>
export const deleteTag = async (id: string): Promise<void>
export const addTagToDiary = async (diaryId: string, tagId: string): Promise<void>
export const removeTagFromDiary = async (diaryId: string, tagId: string): Promise<void>
export const getTagsForDiary = async (diaryId: string): Promise<Tag[]>
```

### 回顾岛数据

```typescript
// 热力图：返回日期 -> 日记数量的映射
export const getHeatmapData = async (
  days?: number,
  query?: string,
  tagIds?: string[],
  timeFilter?: TimeFilter,
  selectedDate?: string | null,
  monthFilter?: MonthFilter | null
): Promise<Map<string, number>>

// 词频：中文双字词统计（过滤停用词）
export const getWordFrequency = async (
  months?: number,
  query?: string,
  tagIds?: string[],
  timeFilter?: TimeFilter,
  selectedDate?: string | null,
  monthFilter?: MonthFilter | null
): Promise<Map<string, number>>
```

### 草稿管理

```typescript
export interface Draft {
  id: string;
  diaryId: string | null;
  title: string;
  content: string;
  date: string;
  media: MediaItem[];
  tags: Tag[];
  updatedAt: number;
}

export const saveDraft = async (draft: Draft): Promise<void>
export const getDraft = async (id: string): Promise<Draft | null>
export const getDraftForDiary = async (diaryId: string): Promise<Draft | null>
export const deleteDraft = async (id: string): Promise<void>
export const getAllDrafts = async (): Promise<Draft[]>
```

### 数据替换（备份导入用）

```typescript
// 原子替换所有数据（事务包裹）
export const replaceAllData = async (entries: DiaryEntry[], tags: Tag[]): Promise<void>
```

### 辅助函数

```typescript
// 清理未被任何日记引用的孤立标签，返回删除数量
export const cleanupUnusedTags = async (): Promise<number>

// 仅替换日记数据（保留现有标签表，用于特定场景）
export const replaceAllDiaries = async (entries: DiaryEntry[]): Promise<void>
```

---

## 存储服务

文件：`src/services/storage.ts`

```typescript
// 确保媒体目录存在
export const ensureMediaDir = async (): Promise<void>

// 复制媒体文件到应用沙盒，返回新 uri
export const saveMedia = async (sourceUri: string, fileName: string): Promise<string>

// 删除单个媒体文件（存在才删）
export const deleteMedia = async (uri: string): Promise<void>

// 批量删除日记关联的所有媒体（含缩略图）
export const deleteDiaryMedia = async (media: MediaItem[]): Promise<void>

// 获取媒体目录路径
export const getMediaDir = (): string
```

媒体文件统一存储在：`FileSystem.documentDirectory + 'media/'`

---

## 备份服务

文件：`src/services/backup.ts`

### 导出备份

```typescript
export const exportBackup = async (
  onProgress?: (current: number, total: number, stage: string) => void
): Promise<{ uri: string; diaryCount: number; mediaCount: number }>
```

流程：
1. 读取所有日记和标签
2. 生成 `backup-manifest.json`
3. 读取所有媒体文件为二进制
4. 打包为 ZIP（`jszip`，`uint8array` 模式）
5. 尝试通过 SAF 保存到公共 Downloads
6. 回退到 `expo-sharing` 分享

### 导入备份

```typescript
export const importBackup = async (
  onProgress?: (current: number, total: number, stage: string) => void
): Promise<{ diaryCount: number; mediaCount: number }>
```

流程：
1. `expo-document-picker` 选择 ZIP
2. 校验 manifest 的 `schemaVersion` 和 `appVersion`
3. 提取媒体文件到本地（生成新 UUID 避免冲突）
4. 调用 `replaceAllData()` 原子替换数据库
5. 成功后清理旧媒体文件

### 错误类型

```typescript
class BackupCancelledError extends Error
class BackupAppVersionMismatchError extends Error
class BackupSchemaTooNewError extends Error
```

### 辅助函数

```typescript
// 清理缓存目录中过期的备份 ZIP，默认保留最近 5 个
export const cleanupOldBackups = async (keepCount?: number): Promise<number>
```

---

## 工具函数

### UUID 生成

文件：`src/utils/uuid.ts`

```typescript
export const generateId = (): string
```

生成 UUID v4（React Native 兼容实现，不依赖 `crypto`）。

### 日期处理

文件：`src/utils/date.ts`

```typescript
// 格式化时间戳为可读字符串
export const formatDate = (timestamp: number): string

// 获取相对时间描述
export const getRelativeTime = (timestamp: number): string

// 获取日期范围（用于精准日期筛选）
export const getDateRangeForKey = (dateStr: string): { start: number; end: number } | null
```

### 媒体工具

文件：`src/utils/media.ts`

```typescript
// 根据 mimeType 获取文件扩展名
export const getMediaFileExtension = (media: MediaItem): string

// 从文件名提取扩展名
export const getExtensionFromValue = (fileName: string): string | null

// 为媒体数组分配 position
export const assignMediaPositions = (media: MediaItem[]): MediaItem[]

// 按 position 排序（无 position 时按索引）
export const getOrderedMedia = (media: MediaItem[]): MediaItem[]
```

---

## 自定义 Hooks

### useDiscovery

文件：`src/hooks/useDiscovery.ts`

```typescript
interface UseDiscoveryReturn {
  diaries: DiaryEntry[];
  tags: Tag[];
  heatmapData: Map<string, number>;
  wordCloudData: WordFrequency[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedTags: string[];
  timeFilter: TimeFilter;
  selectedDate: string | null;
  monthFilter: MonthFilter | null;

  setSearchQuery: (query: string) => void;
  setTimeFilter: (filter: TimeFilter) => void;
  toggleTag: (tagId: string) => void;
  clearTags: () => void;
  selectDate: (date: string | null) => void;
  setMonthFilter: (filter: MonthFilter | null) => void;
  clearFilters: () => void;
  refresh: () => Promise<void>;
}

export const useDiscovery = (): UseDiscoveryReturn
```

内部通过 `useEffect` + `debounce`（300ms）协调搜索请求，并通过 `Promise.all` 并行拉取日记、标签、热力图、词云数据。
