import * as SQLite from 'expo-sqlite';
import { DiaryEntry, MediaItem } from '../types';

const DB_NAME = 'diary.db';

let db: SQLite.SQLiteDatabase | null = null;

type DiaryRow = Omit<DiaryEntry, 'media'>;
type MediaRow = MediaItem & { diaryId: string };

const ensureMediaColumns = async (): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(media)');
  const hasPosition = columns.some((column) => column.name === 'position');

  if (!hasPosition) {
    await db.execAsync('ALTER TABLE media ADD COLUMN position INTEGER NOT NULL DEFAULT 0;');
  }
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
};

export const getAllDiaries = async (): Promise<DiaryEntry[]> => {
  if (!db) throw new Error('Database not initialized');

  const diaries = await db.getAllAsync<DiaryRow>(
    'SELECT * FROM diaries ORDER BY createdAt DESC'
  );

  const mediaRows = await db.getAllAsync<MediaRow>(
    'SELECT * FROM media ORDER BY diaryId ASC, position ASC, rowid ASC'
  );

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
  }));
};

export const getDiaryById = async (id: string): Promise<DiaryEntry | null> => {
  if (!db) throw new Error('Database not initialized');

  const diary = await db.getFirstAsync<DiaryEntry>(
    'SELECT * FROM diaries WHERE id = ?',
    [id]
  );

  if (!diary) return null;

  const media = await db.getAllAsync<MediaItem>(
    'SELECT * FROM media WHERE diaryId = ? ORDER BY position ASC, rowid ASC',
    [id]
  );

  return { ...diary, media };
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
};

export const updateDiary = async (entry: DiaryEntry): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync(
    'UPDATE diaries SET title = ?, content = ?, createdAt = ?, updatedAt = ? WHERE id = ?',
    [entry.title, entry.content, entry.createdAt, entry.updatedAt, entry.id]
  );

  // Delete existing media and re-insert
  await db.runAsync('DELETE FROM media WHERE diaryId = ?', [entry.id]);

  for (const media of entry.media) {
    await db.runAsync(
      'INSERT INTO media (id, diaryId, type, uri, thumbnail, position) VALUES (?, ?, ?, ?, ?, ?)',
      [media.id, entry.id, media.type, media.uri, media.thumbnail || null, media.position ?? 0]
    );
  }
};

export const deleteDiary = async (id: string): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.runAsync('DELETE FROM media WHERE diaryId = ?', [id]);
  await db.runAsync('DELETE FROM diaries WHERE id = ?', [id]);
};

export const replaceAllDiaries = async (entries: DiaryEntry[]): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  await db.withTransactionAsync(async () => {
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
    }
  });
};
