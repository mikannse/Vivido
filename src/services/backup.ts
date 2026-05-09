import {
  getInfoAsync,
  makeDirectoryAsync,
  documentDirectory,
  cacheDirectory,
  readAsStringAsync,
  writeAsStringAsync,
  StorageAccessFramework,
  readDirectoryAsync,
  deleteAsync,
} from 'expo-file-system/legacy';
import { File as FileHandle } from 'expo-file-system';
import JSZip from 'jszip';
import * as Sharing from 'expo-sharing';
import { getDocumentAsync, DocumentPickerResult } from 'expo-document-picker';
import { DiaryEntry, MediaItem, Tag } from '../types';
import { generateId } from '../utils/uuid';
import { deleteMedia } from './storage';
import { getAllDiaries, getAllTags, replaceAllData, SCHEMA_VERSION } from '../services/database';
import { getMediaFileExtension, getExtensionFromValue } from '../utils/media';
import { APP_VERSION } from '../constants';

const BACKUP_VERSION = 2;
const BACKUP_FOLDER_PREFIX = 'vivido-backup';
const BACKUP_MANIFEST_NAME = 'backup-manifest.json';
const BACKUP_MEDIA_FOLDER = 'media';

interface BackupManifestMedia {
  id: string;
  type: MediaItem['type'];
  /** Relative path within the backup ZIP */
  relativePath: string;
  mimeType: string;
  thumbnailRelativePath?: string;
  position?: number;
}

interface BackupManifestTag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

interface BackupManifestDiary {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  media: BackupManifestMedia[];
  tags: BackupManifestTag[];
}

interface BackupManifest {
  version: number;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  tags: BackupManifestTag[];
  diaries: BackupManifestDiary[];
}

export class BackupCancelledError extends Error {
  constructor() {
    super('Backup selection cancelled');
    this.name = 'BackupCancelledError';
  }
}

export class BackupAppVersionMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupAppVersionMismatchError';
  }
}

export class BackupSchemaTooNewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupSchemaTooNewError';
  }
}

const compareVersions = (a: string, b: string): number => {
  const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const av = parse(a);
  const bv = parse(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const diff = (av[i] || 0) - (bv[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

const parseBackupManifest = (rawContent: string): BackupManifest => {
  const parsed = JSON.parse(rawContent) as Partial<BackupManifest>;

  if (
    (parsed.version !== 1 && parsed.version !== BACKUP_VERSION) ||
    !Array.isArray(parsed.diaries)
  ) {
    throw new Error('Unsupported backup format');
  }

  const parsedTags = Array.isArray(parsed.tags) ? parsed.tags : [];
  const normalizeTag = (tag: unknown): BackupManifestTag => {
    if (
      !tag ||
      typeof tag !== 'object' ||
      typeof (tag as BackupManifestTag).id !== 'string' ||
      typeof (tag as BackupManifestTag).name !== 'string' ||
      typeof (tag as BackupManifestTag).color !== 'string' ||
      typeof (tag as BackupManifestTag).createdAt !== 'number'
    ) {
      throw new Error('Backup manifest tag entry is invalid');
    }

    return {
      id: (tag as BackupManifestTag).id,
      name: (tag as BackupManifestTag).name,
      color: (tag as BackupManifestTag).color,
      createdAt: (tag as BackupManifestTag).createdAt,
    };
  };

  const schemaVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;

  return {
    version: parsed.version,
    schemaVersion,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date(0).toISOString(),
    appVersion: parsed.appVersion || APP_VERSION,
    tags: parsedTags.map(normalizeTag),
    diaries: parsed.diaries.map((diary) => {
      if (
        !diary ||
        typeof diary.id !== 'string' ||
        typeof diary.title !== 'string' ||
        typeof diary.content !== 'string' ||
        typeof diary.createdAt !== 'number' ||
        typeof diary.updatedAt !== 'number' ||
        !Array.isArray(diary.media)
      ) {
        throw new Error('Backup manifest is invalid');
      }

      return {
        id: diary.id,
        title: diary.title,
        content: diary.content,
        createdAt: diary.createdAt,
        updatedAt: diary.updatedAt,
        media: diary.media.map((media) => {
          if (
            !media ||
            typeof media.id !== 'string' ||
            (media.type !== 'image' && media.type !== 'video') ||
            typeof media.relativePath !== 'string'
          ) {
            throw new Error('Backup manifest media entry is invalid');
          }

          return {
            id: media.id,
            type: media.type,
            relativePath: media.relativePath,
            mimeType: media.mimeType || (media.type === 'video' ? 'video/mp4' : 'image/jpeg'),
            thumbnailRelativePath: media.thumbnailRelativePath,
            position: media.position,
          };
        }),
        tags: Array.isArray(diary.tags) ? diary.tags.map(normalizeTag) : [],
      };
    }),
  };
};

export const exportBackup = async (
  onProgress?: (current: number, total: number, stage: string) => void
): Promise<{
  uri: string;
  diaryCount: number;
  mediaCount: number;
}> => {
  const diaries = await getAllDiaries();
  const tags = await getAllTags();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipFileName = `${BACKUP_FOLDER_PREFIX}-${timestamp}.zip`;

  if (!cacheDirectory) {
    throw new Error('缓存目录不可用');
  }

  const zip = new JSZip();

  // Add manifest JSON
  const manifestData: BackupManifest = {
    version: BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    tags: tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt,
    })),
    diaries: diaries.map((diary) => ({
      id: diary.id,
      title: diary.title,
      content: diary.content,
      createdAt: diary.createdAt,
      updatedAt: diary.updatedAt,
      media: diary.media.map((media) => {
        const ext = getMediaFileExtension(media);
        const fileName = `${media.id}.${ext}`;
        return {
          id: media.id,
          type: media.type,
          relativePath: `${BACKUP_MEDIA_FOLDER}/${fileName}`,
          mimeType: media.type === 'video' ? 'video/mp4' : 'image/jpeg',
          thumbnailRelativePath: media.thumbnail ? `${BACKUP_MEDIA_FOLDER}/${media.id}_thumb.${ext}` : undefined,
          position: media.position,
        };
      }),
      tags: diary.tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        createdAt: tag.createdAt,
      })),
    })),
  };

  zip.file(BACKUP_MANIFEST_NAME, JSON.stringify(manifestData, null, 2));

  // Calculate total media files (including thumbnails) for progress
  let totalMediaItems = 0;
  for (const diary of diaries) {
    for (const media of diary.media) {
      totalMediaItems += 1;
      if (media.thumbnail) totalMediaItems += 1;
    }
  }

  // Add media files using binary reads to reduce memory overhead
  let mediaCount = 0;
  let processedCount = 0;
  const failedFiles: string[] = [];

  for (const diary of diaries) {
    for (const media of diary.media) {
      try {
        const ext = getMediaFileExtension(media);
        const fileName = `${media.id}.${ext}`;

        const mediaFile = new FileHandle(media.uri);
        const mediaBytes = await mediaFile.bytes();
        zip.file(`${BACKUP_MEDIA_FOLDER}/${fileName}`, mediaBytes);
        processedCount += 1;
        onProgress?.(processedCount, totalMediaItems, fileName);

        if (media.thumbnail) {
          const thumbFile = new FileHandle(media.thumbnail);
          const thumbBytes = await thumbFile.bytes();
          zip.file(`${BACKUP_MEDIA_FOLDER}/${media.id}_thumb.${ext}`, thumbBytes);
          processedCount += 1;
          onProgress?.(processedCount, totalMediaItems, `${media.id}_thumb.${ext}`);
        }
        mediaCount += 1;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        failedFiles.push(`${media.id}: ${errorMsg}`);
        console.warn(`Failed to add media ${media.id}:`, err);
      }
    }
  }

  onProgress?.(processedCount, totalMediaItems, '正在生成压缩文件...');

  // Generate ZIP file as Uint8Array to avoid base64 memory overhead
  const zipContent = await zip.generateAsync({ type: 'uint8array' });

  // Write ZIP to cache directory using modern File API
  let zipPath: string | undefined;

  try {
    zipPath = `${cacheDirectory}${zipFileName}`;
    const outputFile = new FileHandle(zipPath);
    await outputFile.write(zipContent);

    // Try to save to public Downloads using SAF (Storage Access Framework)
    try {
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const dirUri = permissions.directoryUri;
        const fileUri = await StorageAccessFramework.createFileAsync(
          dirUri,
          zipFileName,
          'application/zip'
        );
        // Read cached file as base64 for SAF (legacy API requires base64)
        const zipBase64 = await readAsStringAsync(zipPath, { encoding: 'base64' });
        await StorageAccessFramework.writeAsStringAsync(fileUri, zipBase64, {
          encoding: 'base64',
        });
      }
    } catch (err) {
      console.warn('Failed to save via SAF:', err);
    }

    // Share the ZIP file
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(zipPath, {
        mimeType: 'application/zip',
        dialogTitle: '导出日记备份',
      });
    }

    if (failedFiles.length > 0) {
      throw new Error(`部分媒体文件导出失败，共 ${failedFiles.length} 个:\n${failedFiles.join('\n')}`);
    }

    return {
      uri: zipPath,
      diaryCount: diaries.length,
      mediaCount,
    };
  } catch (error) {
    if (zipPath) {
      try {
        await deleteAsync(zipPath, { idempotent: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    throw error;
  }
};

export const importBackup = async (
  onProgress?: (current: number, total: number, stage: string) => void
): Promise<{
  diaryCount: number;
  mediaCount: number;
}> => {
  // Pick the backup ZIP file
  const result: DocumentPickerResult = await getDocumentAsync({
    type: ['application/zip', 'application/x-zip-compressed'],
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    throw new BackupCancelledError();
  }

  const zipFile = result.assets[0];

  // Read ZIP file content as binary
  const zipFileHandle = new FileHandle(zipFile.uri);
  const zipContent = await zipFileHandle.bytes();

  // Load ZIP
  const zip = await JSZip.loadAsync(zipContent);

  // Find and parse manifest
  const manifestFile = zip.file(BACKUP_MANIFEST_NAME);
  if (!manifestFile) {
    throw new Error('Invalid backup: manifest not found');
  }

  const manifestContent = await manifestFile.async('string');
  const manifest = parseBackupManifest(manifestContent);

  // Validate schema version
  if (manifest.schemaVersion > SCHEMA_VERSION) {
    throw new BackupSchemaTooNewError(
      `备份 schema 版本 (${manifest.schemaVersion}) 高于当前应用支持的版本 (${SCHEMA_VERSION})，请升级应用后重试`
    );
  }

  // Validate app version (warn but don't block for older backups)
  if (compareVersions(manifest.appVersion, APP_VERSION) > 0) {
    throw new BackupAppVersionMismatchError(
      `备份来自更新的应用版本 (${manifest.appVersion})，当前版本为 ${APP_VERSION}，请升级应用后重试`
    );
  }

  const currentDiaries = await getAllDiaries();
  const importedFiles: string[] = [];
  let mediaCount = 0;

  try {
    const importedEntries: DiaryEntry[] = [];
    const importedTags = new Map<string, Tag>();

    // Import all tags from manifest
    for (const tag of manifest.tags) {
      importedTags.set(tag.id, tag);
    }

    // Ensure media directory exists
    const mediaDestDir = documentDirectory + 'media/';
    const mediaDirInfo = await getInfoAsync(mediaDestDir);
    if (!mediaDirInfo.exists) {
      await makeDirectoryAsync(mediaDestDir, { intermediates: true });
    }

    // Calculate total media files for progress
    let totalMediaItems = 0;
    for (const diary of manifest.diaries) {
      totalMediaItems += diary.media.length;
    }
    let processedCount = 0;

    // Import each diary
    for (const diary of manifest.diaries) {
      const importedMedia: MediaItem[] = [];

      for (const media of diary.media) {
        const mediaFile = zip.file(media.relativePath);
        if (!mediaFile) {
          throw new Error(`Missing media file: ${media.relativePath}`);
        }

        // Generate new filename to avoid conflicts
        const ext = getExtensionFromValue(media.relativePath) ?? (media.type === 'video' ? 'mp4' : 'jpg');
        const newFileName = `${generateId()}.${ext}`;
        const destPath = `${mediaDestDir}${newFileName}`;

        // Extract and save media file using binary data
        const mediaData = await mediaFile.async('uint8array');
        const destFile = new FileHandle(destPath);
        await destFile.write(mediaData);
        importedFiles.push(destPath);

        let thumbnailUri: string | undefined;
        if (media.thumbnailRelativePath) {
          const thumbFile = zip.file(media.thumbnailRelativePath);
          if (thumbFile) {
            const thumbFileName = `${generateId()}_thumb.jpg`;
            thumbnailUri = `${mediaDestDir}${thumbFileName}`;
            const thumbData = await thumbFile.async('uint8array');
            const thumbDestFile = new FileHandle(thumbnailUri);
            await thumbDestFile.write(thumbData);
            importedFiles.push(thumbnailUri);
          }
        }

        importedMedia.push({
          id: media.id,
          type: media.type,
          uri: destPath,
          thumbnail: thumbnailUri,
          position: media.position,
        });
        mediaCount += 1;
        processedCount += 1;
        onProgress?.(processedCount, totalMediaItems, newFileName);
      }

      // Collect tags from this diary
      const diaryTags = (diary.tags || []).map((tag) => {
        if (!importedTags.has(tag.id)) {
          importedTags.set(tag.id, tag);
        }
        return tag;
      });

      importedEntries.push({
        id: diary.id,
        title: diary.title,
        content: diary.content,
        createdAt: diary.createdAt,
        updatedAt: diary.updatedAt,
        media: importedMedia,
        tags: diaryTags,
      });
    }

    // Replace all data in database
    await replaceAllData(importedEntries, Array.from(importedTags.values()));
  } catch (error) {
    // Clean up imported files on error (only when import itself failed)
    for (const uri of importedFiles) {
      await deleteMedia(uri);
    }
    throw error;
  }

  // After successful database replacement, delete old media files separately.
  // Old media deletion failures must NOT trigger cleanup of newly imported files.
  try {
    for (const diary of currentDiaries) {
      for (const media of diary.media) {
        await deleteMedia(media.uri);
        if (media.thumbnail) {
          await deleteMedia(media.thumbnail);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to delete old media files after import:', err);
  }

  return {
    diaryCount: manifest.diaries.length,
    mediaCount,
  };
};

export const cleanupOldBackups = async (keepCount: number = 5): Promise<number> => {
  if (!cacheDirectory) return 0;

  try {
    const files = await readDirectoryAsync(cacheDirectory);
    const backupFiles = files
      .filter((name) => name.startsWith(BACKUP_FOLDER_PREFIX) && name.endsWith('.zip'))
      .sort((a, b) => b.localeCompare(a));

    const toDelete = backupFiles.slice(keepCount);
    for (const fileName of toDelete) {
      await deleteAsync(`${cacheDirectory}${fileName}`, { idempotent: true });
    }

    return toDelete.length;
  } catch {
    return 0;
  }
};
