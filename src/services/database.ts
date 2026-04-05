import * as SQLite from 'expo-sqlite';
import { DiaryEntry, MediaItem, Tag, TimeFilter } from '../types';

const DB_NAME = 'diary.db';

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

export const initDatabase = async (): Promise<void> => {
  db = await SQLite.openDatabaseAsync(DB_NAME);

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
  `);

  await ensureMediaColumns();
  await ensureTagTables();
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

// Search and filter diaries
export const searchDiaries = async (
  query: string,
  tagIds: string[],
  timeFilter: TimeFilter
): Promise<DiaryEntry[]> => {
  if (!db) throw new Error('Database not initialized');

  let sql = 'SELECT * FROM diaries WHERE 1=1';
  const params: (string | number)[] = [];

  // Text search
  if (query.trim()) {
    sql += ' AND (title LIKE ? OR content LIKE ?)';
    const searchTerm = `%${query.trim()}%`;
    params.push(searchTerm, searchTerm);
  }

  // Time filter
  const now = new Date();
  if (timeFilter === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    sql += ' AND createdAt >= ?';
    params.push(weekAgo.getTime());
  } else if (timeFilter === 'month') {
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    sql += ' AND createdAt >= ?';
    params.push(monthAgo.getTime());
  } else if (timeFilter === 'sameDayLastYear') {
    const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const dayStart = new Date(lastYear.getFullYear(), lastYear.getMonth(), lastYear.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
    sql += ' AND createdAt >= ? AND createdAt <= ?';
    params.push(dayStart, dayEnd);
  }

  sql += ' ORDER BY createdAt DESC';

  const diaries = await db.getAllAsync<DiaryRow>(sql, params);

  // Filter by tags if needed
  let filteredDiaries = diaries;
  if (tagIds.length > 0) {
    const placeholders = tagIds.map(() => '?').join(',');
    const taggedDiaryIds = await db.getAllAsync<{ diaryId: string }>(
      `SELECT DISTINCT diaryId FROM diary_tags WHERE tagId IN (${placeholders})`,
      tagIds
    );
    const taggedIds = new Set(taggedDiaryIds.map((r) => r.diaryId));
    filteredDiaries = diaries.filter((d) => taggedIds.has(d.id));
  }

  const diaryIds = filteredDiaries.map((d) => d.id);
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

  return filteredDiaries.map((diary) => ({
    ...diary,
    media: mediaByDiaryId.get(diary.id) ?? [],
    tags: tagsMap.get(diary.id) ?? [],
  }));
};

// Get heatmap data (count entries per day)
export const getHeatmapData = async (days: number = 365): Promise<Map<string, number>> => {
  if (!db) throw new Error('Database not initialized');

  const startDate = Date.now() - days * 24 * 60 * 60 * 1000;

  const rows = await db.getAllAsync<{ date: string; count: number }>(
    `SELECT date(createdAt/1000, 'unixepoch') as date, COUNT(*) as count
     FROM diaries
     WHERE createdAt >= ?
     GROUP BY date`,
    [startDate]
  );

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.date, row.count);
  }
  return map;
};

// Get word frequency from diary content
export const getWordFrequency = async (months: number = 1): Promise<Map<string, number>> => {
  if (!db) throw new Error('Database not initialized');

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setHours(0, 0, 0, 0);

  const diaries = await db.getAllAsync<{ content: string }>(
    'SELECT content FROM diaries WHERE createdAt >= ?',
    [startDate.getTime()]
  );

  // Simple Chinese word extraction (character-based for simplicity)
  const wordCount = new Map<string, number>();
  const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '什么', '吗', '吧', '呢', '啊', '哦', '嗯', '呀', '哈', '啦']);

  for (const diary of diaries) {
    // Extract Chinese characters and words (2-4 characters)
    const content = diary.content;
    for (let i = 0; i < content.length; i++) {
      // Extract 2-character words
      if (i < content.length - 1) {
        const word = content.substring(i, i + 2);
        if (!stopWords.has(word) && /[\u4e00-\u9fa5]/.test(word)) {
          wordCount.set(word, (wordCount.get(word) || 0) + 1);
        }
      }
    }
  }

  return wordCount;
};

export const createDiary = async (entry: DiaryEntry): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    'INSERT INTO diaries (id, title, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    [entry.id, entry.title, entry.content, entry.createdAt, entry.updatedAt]
  );

  for (const media of entry.media) {
    await db.runAsync(
      'INSERT INTO media (id, diaryId, type, uri, thumbnail, position) VALUES (?, ?, ?, ?, ?, ?)',
      [media.id, entry.id, media.type, media.uri, media.thumbnail || null, media.position ?? 0]
    );
  }

  for (const tag of entry.tags) {
    await db.runAsync(
      'INSERT OR IGNORE INTO diary_tags (diaryId, tagId) VALUES (?, ?)',
      [entry.id, tag.id]
    );
  }
};

export const updateDiary = async (entry: DiaryEntry): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    'UPDATE diaries SET title = ?, content = ?, createdAt = ?, updatedAt = ? WHERE id = ?',
    [entry.title, entry.content, entry.createdAt, entry.updatedAt, entry.id]
  );

  await db.runAsync('DELETE FROM media WHERE diaryId = ?', [entry.id]);

  for (const media of entry.media) {
    await db.runAsync(
      'INSERT INTO media (id, diaryId, type, uri, thumbnail, position) VALUES (?, ?, ?, ?, ?, ?)',
      [media.id, entry.id, media.type, media.uri, media.thumbnail || null, media.position ?? 0]
    );
  }

  await db.runAsync('DELETE FROM diary_tags WHERE diaryId = ?', [entry.id]);

  for (const tag of entry.tags) {
    await db.runAsync(
      'INSERT OR IGNORE INTO diary_tags (diaryId, tagId) VALUES (?, ?)',
      [entry.id, tag.id]
    );
  }
};

export const deleteDiary = async (id: string): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync('DELETE FROM diary_tags WHERE diaryId = ?', [id]);
  await db.runAsync('DELETE FROM media WHERE diaryId = ?', [id]);
  await db.runAsync('DELETE FROM diaries WHERE id = ?', [id]);
};

export const replaceAllDiaries = async (entries: DiaryEntry[]): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.withTransactionAsync(async () => {
    await db!.runAsync('DELETE FROM diary_tags');
    await db!.runAsync('DELETE FROM media');
    await db!.runAsync('DELETE FROM diaries');

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

// Simple ID generator (for tags without uuid dependency)
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};