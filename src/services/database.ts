import * as SQLite from 'expo-sqlite';
import { DiaryEntry, MediaItem, Tag, TimeFilter, MonthFilter } from '../types';
import { getDateRangeForKey } from '../utils/date';
import { generateId } from '../utils/uuid';
import { accumulateWordFrequency, type WordCount } from '../utils/wordcloud';

const DB_NAME = 'diary.db';
export const SCHEMA_VERSION = 3;

let db: SQLite.SQLiteDatabase | null = null;

type DiaryRow = Omit<DiaryEntry, 'media' | 'tags'>;
type MediaRow = MediaItem & { diaryId: string };
type TagRow = Tag;

const ensureMediaColumns = async (): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(media)');
  const hasPosition = columns.some((column) => column.name === 'position');

  if (!hasPosition) {
    await db.execAsync('ALTER TABLE media ADD COLUMN position INTEGER NOT NULL DEFAULT 0;');
  }
};

const ensureTagTables = async (): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#c47030',
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS diary_tags (
      diaryId TEXT NOT NULL,
      tagId TEXT NOT NULL,
      PRIMARY KEY (diaryId, tagId),
      FOREIGN KEY (diaryId) REFERENCES diaries(id) ON DELETE CASCADE,
      FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
    );
  `);
};

const ensureDraftTable = async (): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY NOT NULL,
      diaryId TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      date TEXT NOT NULL,
      media TEXT NOT NULL,
      tags TEXT NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (diaryId) REFERENCES diaries(id) ON DELETE CASCADE
    );
  `);

  // SQLite cannot ALTER TABLE ADD FOREIGN KEY; migrate via table rebuild if needed
  const fkList = await db.getAllAsync<{ table: string; from: string }>(
    "PRAGMA foreign_key_list('drafts')"
  );
  const hasFk = fkList.some((fk) => fk.from === 'diaryId' && fk.table === 'diaries');

  if (!hasFk) {
    await db.execAsync(`
      DELETE FROM drafts WHERE diaryId IS NOT NULL AND diaryId NOT IN (SELECT id FROM diaries);

      CREATE TABLE drafts_new (
        id TEXT PRIMARY KEY NOT NULL,
        diaryId TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        date TEXT NOT NULL,
        media TEXT NOT NULL,
        tags TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (diaryId) REFERENCES diaries(id) ON DELETE CASCADE
      );

      INSERT INTO drafts_new SELECT * FROM drafts;
      DROP TABLE drafts;
      ALTER TABLE drafts_new RENAME TO drafts;
    `);
  }

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_drafts_diaryId ON drafts(diaryId);
    CREATE INDEX IF NOT EXISTS idx_drafts_updatedAt ON drafts(updatedAt DESC);
  `);
};

export const initDatabase = async (): Promise<void> => {
  db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync(`PRAGMA foreign_keys = ON;`);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS diaries (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY NOT NULL,
      diaryId TEXT NOT NULL,
      type TEXT NOT NULL,
      uri TEXT NOT NULL,
      thumbnail TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (diaryId) REFERENCES diaries(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_diaries_createdAt ON diaries(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_media_diaryId ON media(diaryId);
  `);

  await ensureMediaColumns();
  await ensureTagTables();
  await ensureDraftTable();
  await ensureSchemaVersion();
};

const MIGRATIONS: Record<number, string[]> = {
  2: [], // Version 2 is baseline; structural additions handled by ensure* helpers
  3: [], // Version 3 adds audio media type; media.type is a TEXT column, no ALTER TABLE needed
};

const ensureSchemaVersion = async (): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      description TEXT,
      appliedAt INTEGER NOT NULL
    );
  `);

  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );

  const currentVersion = row?.version ?? 0;

  if (currentVersion === 0) {
    await db.runAsync(
      'INSERT INTO schema_version (version, description, appliedAt) VALUES (?, ?, ?)',
      [SCHEMA_VERSION, 'Initial schema', Date.now()]
    );
  } else if (currentVersion < SCHEMA_VERSION) {
    for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
      const migrations = MIGRATIONS[v];
      if (migrations) {
        for (const sql of migrations) {
          await db.execAsync(sql);
        }
      }
      await db.runAsync(
        'INSERT INTO schema_version (version, description, appliedAt) VALUES (?, ?, ?)',
        [v, `Migration to version ${v}`, Date.now()]
      );
    }
  }
};

export const getSchemaVersion = async (): Promise<number> => {
  if (!db) throw new Error('Database not initialized');

  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );

  return row?.version ?? 0;
};

// Tag operations
export const createTag = async (name: string, color: string = '#c47030'): Promise<Tag> => {
  if (!db) throw new Error('Database not initialized');

  const id = generateId();
  const createdAt = Date.now();

  await db.runAsync(
    'INSERT INTO tags (id, name, color, createdAt) VALUES (?, ?, ?, ?)',
    [id, name, color, createdAt]
  );

  return { id, name, color, createdAt };
};

export const getAllTags = async (): Promise<Tag[]> => {
  if (!db) throw new Error('Database not initialized');

  return db.getAllAsync<TagRow>('SELECT * FROM tags ORDER BY name ASC');
};

export const deleteTag = async (id: string): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync('DELETE FROM diary_tags WHERE tagId = ?', [id]);
  await db.runAsync('DELETE FROM tags WHERE id = ?', [id]);
};

export const addTagToDiary = async (diaryId: string, tagId: string): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    'INSERT OR IGNORE INTO diary_tags (diaryId, tagId) VALUES (?, ?)',
    [diaryId, tagId]
  );
};

export const removeTagFromDiary = async (diaryId: string, tagId: string): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    'DELETE FROM diary_tags WHERE diaryId = ? AND tagId = ?',
    [diaryId, tagId]
  );
};

export const getTagsForDiary = async (diaryId: string): Promise<Tag[]> => {
  if (!db) throw new Error('Database not initialized');

  return db.getAllAsync<TagRow>(
    `SELECT t.* FROM tags t
     INNER JOIN diary_tags dt ON t.id = dt.tagId
     WHERE dt.diaryId = ?`,
    [diaryId]
  );
};

export const getDiariesByTag = async (tagId: string): Promise<string[]> => {
  if (!db) throw new Error('Database not initialized');

  const rows = await db.getAllAsync<{ diaryId: string }>(
    'SELECT diaryId FROM diary_tags WHERE tagId = ?',
    [tagId]
  );
  return rows.map((r) => r.diaryId);
};

// Get tags for multiple diaries at once
const getTagsForDiaries = async (diaryIds: string[]): Promise<Map<string, Tag[]>> => {
  if (!db || diaryIds.length === 0) return new Map();

  const placeholders = diaryIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<TagRow & { diaryId: string }>(
    `SELECT t.*, dt.diaryId FROM tags t
     INNER JOIN diary_tags dt ON t.id = dt.tagId
     WHERE dt.diaryId IN (${placeholders})`,
    diaryIds
  );

  const map = new Map<string, Tag[]>();
  for (const row of rows) {
    const existing = map.get(row.diaryId) ?? [];
    existing.push({ id: row.id, name: row.name, color: row.color, createdAt: row.createdAt });
    map.set(row.diaryId, existing);
  }
  return map;
};

// Diary operations with tags
export const getAllDiaries = async (): Promise<DiaryEntry[]> => {
  if (!db) throw new Error('Database not initialized');

  const diaries = await db.getAllAsync<DiaryRow>(
    'SELECT * FROM diaries ORDER BY createdAt DESC'
  );

  const mediaRows = await db.getAllAsync<MediaRow>(
    'SELECT * FROM media ORDER BY diaryId ASC, position ASC, rowid ASC'
  );

  const diaryIds = diaries.map((d) => d.id);
  const tagsMap = await getTagsForDiaries(diaryIds);

  const mediaByDiaryId = new Map<string, MediaItem[]>();
  for (const media of mediaRows) {
    const existing = mediaByDiaryId.get(media.diaryId) ?? [];
    existing.push({
      id: media.id,
      type: media.type,
      uri: media.uri,
      thumbnail: media.thumbnail,
      position: media.position,
    });
    mediaByDiaryId.set(media.diaryId, existing);
  }

  return diaries.map((diary) => ({
    ...diary,
    media: mediaByDiaryId.get(diary.id) ?? [],
    tags: tagsMap.get(diary.id) ?? [],
  }));
};

// Paginated diary loading for better performance
// Uses a cap per diary to bound the result set. Increased from 3 to 10 to
// prevent audio attachments from being silently dropped when a diary has
// >=3 visual media items plus audio (see #2).
export const getDiariesPaginated = async (
  limit: number,
  offset: number,
  mediaLimitPerDiary: number = 10
): Promise<{ diaries: DiaryEntry[]; total: number }> => {
  if (!db) throw new Error('Database not initialized');

  // Get total count for pagination indicator
  const countResult = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM diaries'
  );
  const total = countResult?.count ?? 0;

  // Get paginated diaries
  const diaries = await db.getAllAsync<DiaryRow>(
    'SELECT * FROM diaries ORDER BY createdAt DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );

  if (diaries.length === 0) {
    return { diaries: [], total };
  }

  const diaryIds = diaries.map((d) => d.id);
  const tagsMap = await getTagsForDiaries(diaryIds);

  // Only fetch limited media for the diaries we got (not all media)
  // Using row_number to limit media per diary to what's needed for display
  const mediaPlaceholders = diaryIds.map(() => '?').join(',');
  const mediaRows = await db.getAllAsync<MediaRow & { diaryId: string; rowNum: number }>(
    `SELECT m.*, ROW_NUMBER() OVER (PARTITION BY m.diaryId ORDER BY m.position ASC, m.rowid ASC) as rowNum
     FROM media m
     WHERE m.diaryId IN (${mediaPlaceholders})`,
    diaryIds
  );

  const mediaByDiaryId = new Map<string, MediaItem[]>();
  for (const media of mediaRows) {
    // Only keep up to mediaLimitPerDiary per diary
    if (media.rowNum <= mediaLimitPerDiary) {
      const existing = mediaByDiaryId.get(media.diaryId) ?? [];
      existing.push({
        id: media.id,
        type: media.type,
        uri: media.uri,
        thumbnail: media.thumbnail,
        position: media.position,
      });
      mediaByDiaryId.set(media.diaryId, existing);
    }
  }

  return {
    diaries: diaries.map((diary) => ({
      ...diary,
      media: mediaByDiaryId.get(diary.id) ?? [],
      tags: tagsMap.get(diary.id) ?? [],
    })),
    total,
  };
};

export const getDiaryById = async (id: string): Promise<DiaryEntry | null> => {
  if (!db) throw new Error('Database not initialized');

  const diary = await db.getFirstAsync<DiaryRow>(
    'SELECT * FROM diaries WHERE id = ?',
    [id]
  );

  if (!diary) return null;

  const media = await db.getAllAsync<MediaItem>(
    'SELECT * FROM media WHERE diaryId = ? ORDER BY position ASC, rowid ASC',
    [id]
  );

  const tags = await getTagsForDiary(id);

  return { ...diary, media, tags };
};

// Get adjacent diary IDs (previous and next) for navigation
// Optimized: uses LIMIT 1 instead of loading all IDs into memory
export const getAdjacentDiaryIds = async (
  diaryId: string
): Promise<{ prevId: string | null; nextId: string | null }> => {
  if (!db) throw new Error('Database not initialized');

  // Get the createdAt of the current diary
  const current = await db.getFirstAsync<{ createdAt: number }>(
    'SELECT createdAt FROM diaries WHERE id = ?',
    [diaryId]
  );

  if (!current) {
    return { prevId: null, nextId: null };
  }

  // prevId: older diary (createdAt > current, i.e., higher timestamp = older in time)
  // Ordered ASC so we get the closest older entry
  const prev = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM diaries WHERE createdAt > ? ORDER BY createdAt ASC LIMIT 1',
    [current.createdAt]
  );

  // nextId: newer diary (createdAt < current, i.e., lower timestamp = newer in time)
  // Ordered DESC so we get the closest newer entry
  const next = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM diaries WHERE createdAt < ? ORDER BY createdAt DESC LIMIT 1',
    [current.createdAt]
  );

  return { prevId: prev?.id ?? null, nextId: next?.id ?? null };
};

/**
 * 控制 buildDiscoveryWhereClause 中哪些筛选维度生效。
 * 用于 getWordFrequency 等场景，需要部分跳过时间/日期/月份筛选。
 */
type DiscoveryWhereOptions = {
  disableTimeFilter?: boolean;
  disableDateFilter?: boolean;
  disableMonthFilter?: boolean;
};

const buildDiscoveryWhereClause = (
  query: string,
  tagIds: string[],
  timeFilter: TimeFilter,
  selectedDate?: string | null,
  monthFilter?: MonthFilter | null,
  options?: DiscoveryWhereOptions
): { whereSql: string; params: (string | number)[] } => {
  let whereSql = ' WHERE 1=1';
  const params: (string | number)[] = [];

  if (query.trim()) {
    whereSql += ' AND (title LIKE ? OR content LIKE ?)';
    const searchTerm = `%${query.trim()}%`;
    params.push(searchTerm, searchTerm);
  }

  if (!options?.disableDateFilter && selectedDate) {
    const range = getDateRangeForKey(selectedDate);
    if (range) {
      whereSql += ' AND createdAt >= ? AND createdAt <= ?';
      params.push(range.start, range.end);
    }
  } else if (!options?.disableMonthFilter && monthFilter) {
    const startOfMonth = new Date(monthFilter.year, monthFilter.month - 1, 1).getTime();
    const endOfMonth = new Date(monthFilter.year, monthFilter.month, 0, 23, 59, 59, 999).getTime();
    whereSql += ' AND createdAt >= ? AND createdAt <= ?';
    params.push(startOfMonth, endOfMonth);
  } else if (!options?.disableTimeFilter) {
    const now = new Date();
    if (timeFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      whereSql += ' AND createdAt >= ?';
      params.push(weekAgo.getTime());
    } else if (timeFilter === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      whereSql += ' AND createdAt >= ?';
      params.push(monthAgo.getTime());
    }
  }

  if (tagIds.length > 0) {
    // OR logic: diary must have ANY of the selected tags
    whereSql += ` AND EXISTS (
      SELECT 1 FROM diary_tags dt
      WHERE dt.diaryId = diaries.id AND dt.tagId IN (${tagIds.map(() => '?').join(',')})
    )`;
    params.push(...tagIds);
  }

  return { whereSql, params };
};

// Search and filter diaries
export const searchDiaries = async (
  query: string,
  tagIds: string[],
  timeFilter: TimeFilter,
  selectedDate?: string | null,
  monthFilter?: MonthFilter | null
): Promise<DiaryEntry[]> => {
  if (!db) throw new Error('Database not initialized');

  const { whereSql, params } = buildDiscoveryWhereClause(
    query,
    tagIds,
    timeFilter,
    selectedDate,
    monthFilter
  );
  const diaries = await db.getAllAsync<DiaryRow>(
    `SELECT * FROM diaries${whereSql} ORDER BY createdAt DESC`,
    params
  );

  const diaryIds = diaries.map((d) => d.id);
  const mediaRows = diaryIds.length > 0
    ? await db.getAllAsync<MediaRow>(
        `SELECT * FROM media WHERE diaryId IN (${diaryIds.map(() => '?').join(',')}) ORDER BY diaryId ASC, position ASC`,
        diaryIds
      )
    : [];

  const tagsMap = await getTagsForDiaries(diaryIds);

  const mediaByDiaryId = new Map<string, MediaItem[]>();
  for (const media of mediaRows) {
    const existing = mediaByDiaryId.get(media.diaryId) ?? [];
    existing.push({
      id: media.id,
      type: media.type,
      uri: media.uri,
      thumbnail: media.thumbnail,
      position: media.position,
    });
    mediaByDiaryId.set(media.diaryId, existing);
  }

  return diaries.map((diary) => ({
    ...diary,
    media: mediaByDiaryId.get(diary.id) ?? [],
    tags: tagsMap.get(diary.id) ?? [],
  }));
};

// Get word frequency from diary content
export const getWordFrequency = async (
  query: string = '',
  tagIds: string[] = [],
  _timeFilter?: TimeFilter,
  _selectedDate?: string | null,
  _monthFilter?: MonthFilter | null
): Promise<Map<string, WordCount>> => {
  if (!db) throw new Error('Database not initialized');

  // 词云始终限制近 30 天，不受当前时间筛选器影响（决策 2026-07-08）。
  // 复用 buildDiscoveryWhereClause 的搜索词+标签筛选，但禁用时间/日期/月份筛选（#6/#11）。
  // 用 Date.now() - 30 天避免 setMonth 跨月回滚问题（#7）。
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  startDate.setHours(0, 0, 0, 0);

  const { whereSql: baseWhereSql, params } = buildDiscoveryWhereClause(
    query, tagIds, 'all',
    undefined, undefined,
    { disableTimeFilter: true, disableDateFilter: true, disableMonthFilter: true }
  );

  let whereSql = baseWhereSql;
  whereSql += ' AND createdAt >= ?';
  params.push(startDate.getTime());

  const diaries = await db.getAllAsync<{ content: string }>(
    `SELECT content FROM diaries${whereSql}`,
    params
  );

  // 分词/词频启发式收敛在 utils/wordcloud（零依赖、无 AI），不外溢到组件
  const wordCount = new Map<string, WordCount>();

  for (const diary of diaries) {
    accumulateWordFrequency(diary.content, wordCount);
  }

  return wordCount;
};

export const createDiary = async (entry: DiaryEntry): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.withTransactionAsync(async () => {
    await db!.runAsync(
      'INSERT INTO diaries (id, title, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
      [entry.id, entry.title, entry.content, entry.createdAt, entry.updatedAt]
    );

    for (const media of entry.media) {
      await db!.runAsync(
        'INSERT INTO media (id, diaryId, type, uri, thumbnail, position) VALUES (?, ?, ?, ?, ?, ?)',
        [media.id, entry.id, media.type, media.uri, media.thumbnail || null, media.position ?? 0]
      );
    }

    for (const tag of entry.tags) {
      await db!.runAsync(
        'INSERT OR IGNORE INTO diary_tags (diaryId, tagId) VALUES (?, ?)',
        [entry.id, tag.id]
      );
    }
  });
};

export const updateDiary = async (entry: DiaryEntry): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.withTransactionAsync(async () => {
    await db!.runAsync(
      'UPDATE diaries SET title = ?, content = ?, createdAt = ?, updatedAt = ? WHERE id = ?',
      [entry.title, entry.content, entry.createdAt, entry.updatedAt, entry.id]
    );

    await db!.runAsync('DELETE FROM media WHERE diaryId = ?', [entry.id]);

    for (const media of entry.media) {
      await db!.runAsync(
        'INSERT INTO media (id, diaryId, type, uri, thumbnail, position) VALUES (?, ?, ?, ?, ?, ?)',
        [media.id, entry.id, media.type, media.uri, media.thumbnail || null, media.position ?? 0]
      );
    }

    await db!.runAsync('DELETE FROM diary_tags WHERE diaryId = ?', [entry.id]);

    for (const tag of entry.tags) {
      await db!.runAsync(
        'INSERT OR IGNORE INTO diary_tags (diaryId, tagId) VALUES (?, ?)',
        [entry.id, tag.id]
      );
    }
  });
};

export const deleteDiary = async (id: string): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.withTransactionAsync(async () => {
    await db!.runAsync('DELETE FROM diary_tags WHERE diaryId = ?', [id]);
    await db!.runAsync('DELETE FROM media WHERE diaryId = ?', [id]);
    await db!.runAsync('DELETE FROM diaries WHERE id = ?', [id]);
  });
};

export const replaceAllData = async (entries: DiaryEntry[], tags: Tag[]): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.withTransactionAsync(async () => {
    await db!.runAsync('DELETE FROM diary_tags');
    await db!.runAsync('DELETE FROM media');
    await db!.runAsync('DELETE FROM diaries');
    await db!.runAsync('DELETE FROM tags');

    for (const tag of tags) {
      await db!.runAsync(
        'INSERT INTO tags (id, name, color, createdAt) VALUES (?, ?, ?, ?)',
        [tag.id, tag.name, tag.color, tag.createdAt]
      );
    }

    for (const entry of entries) {
      await db!.runAsync(
        'INSERT INTO diaries (id, title, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [entry.id, entry.title, entry.content, entry.createdAt, entry.updatedAt]
      );

      for (const media of entry.media) {
        await db!.runAsync(
          'INSERT INTO media (id, diaryId, type, uri, thumbnail, position) VALUES (?, ?, ?, ?, ?, ?)',
          [media.id, entry.id, media.type, media.uri, media.thumbnail || null, media.position ?? 0]
        );
      }

      for (const tag of entry.tags) {
        await db!.runAsync(
          'INSERT OR IGNORE INTO diary_tags (diaryId, tagId) VALUES (?, ?)',
          [entry.id, tag.id]
        );
      }
    }
  });
};

export const cleanupUnusedTags = async (): Promise<number> => {
  if (!db) throw new Error('Database not initialized');

  const result = await db.runAsync(
    'DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tagId FROM diary_tags)'
  );

  return result.changes ?? 0;
};

// Draft operations
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

export const saveDraft = async (draft: Draft): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    'INSERT OR REPLACE INTO drafts (id, diaryId, title, content, date, media, tags, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      draft.id,
      draft.diaryId,
      draft.title,
      draft.content,
      draft.date,
      JSON.stringify(draft.media),
      JSON.stringify(draft.tags),
      draft.updatedAt,
    ]
  );
};

export const getDraft = async (id: string): Promise<Draft | null> => {
  if (!db) throw new Error('Database not initialized');

  const row = await db.getFirstAsync<{
    id: string;
    diaryId: string | null;
    title: string;
    content: string;
    date: string;
    media: string;
    tags: string;
    updatedAt: number;
  }>('SELECT * FROM drafts WHERE id = ?', [id]);

  if (!row) return null;

  return {
    ...row,
    media: JSON.parse(row.media) as MediaItem[],
    tags: JSON.parse(row.tags) as Tag[],
  };
};

export const getDraftForDiary = async (diaryId: string): Promise<Draft | null> => {
  if (!db) throw new Error('Database not initialized');

  const row = await db.getFirstAsync<{
    id: string;
    diaryId: string | null;
    title: string;
    content: string;
    date: string;
    media: string;
    tags: string;
    updatedAt: number;
  }>('SELECT * FROM drafts WHERE diaryId = ?', [diaryId]);

  if (!row) return null;

  return {
    ...row,
    media: JSON.parse(row.media) as MediaItem[],
    tags: JSON.parse(row.tags) as Tag[],
  };
};

export const deleteDraft = async (id: string): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync('DELETE FROM drafts WHERE id = ?', [id]);
};

export const getAllDrafts = async (): Promise<Draft[]> => {
  if (!db) throw new Error('Database not initialized');

  const rows = await db.getAllAsync<{
    id: string;
    diaryId: string | null;
    title: string;
    content: string;
    date: string;
    media: string;
    tags: string;
    updatedAt: number;
  }>('SELECT * FROM drafts ORDER BY updatedAt DESC');

  return rows.map((row) => ({
    ...row,
    media: JSON.parse(row.media) as MediaItem[],
    tags: JSON.parse(row.tags) as Tag[],
  }));
};
