import { getInfoAsync, makeDirectoryAsync, documentDirectory, cacheDirectory, readAsStringAsync, writeAsStringAsync, StorageAccessFramework } from 'expo-file-system/legacy';
import JSZip from 'jszip';
import * as Sharing from 'expo-sharing';
import { getDocumentAsync, DocumentPickerResult } from 'expo-document-picker';
import { DiaryEntry, MediaItem, Tag } from '../types';
import { generateId } from '../utils/uuid';
import { deleteMedia } from './storage';
import { getAllDiaries, getAllTags, replaceAllData } from '../services/database';
import { getMediaFileExtension } from '../utils/media';

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

  return {
    version: parsed.version,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date(0).toISOString(),
    appVersion: parsed.appVersion || '1.0.0',
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

export const exportBackup = async (): Promise<{
  uri: string;
  diaryCount: number;
  mediaCount: number;
}> => {
  const diaries = await getAllDiaries();
  const tags = await getAllTags();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipFileName = `${BACKUP_FOLDER_PREFIX}-${timestamp}.zip`;

  if (!cacheDirectory) {
    throw new Error('Cache directory not available');
  }

  const zip = new JSZip();

  // Add manifest JSON
  const manifestData: BackupManifest = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
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

  // Add media files
  let mediaCount = 0;
  for (const diary of diaries) {
    for (const media of diary.media) {
      try {
        const ext = getMediaFileExtension(media);
        const fileName = `${media.id}.${ext}`;
        const mediaData = await readAsStringAsync(media.uri, { encoding: 'base64' });
        zip.file(`${BACKUP_MEDIA_FOLDER}/${fileName}`, mediaData, { base64: true });

        if (media.thumbnail) {
          const thumbData = await readAsStringAsync(media.thumbnail, { encoding: 'base64' });
          zip.file(`${BACKUP_MEDIA_FOLDER}/${media.id}_thumb.${ext}`, thumbData, { base64: true });
        }
        mediaCount += 1;
      } catch (err) {
        console.warn(`Failed to add media ${media.id}:`, err);
      }
    }
  }

  // Generate ZIP file
  const zipContent = await zip.generateAsync({ type: 'base64' });

  // Write ZIP to cache directory first
  const zipPath = `${cacheDirectory}${zipFileName}`;
  await writeAsStringAsync(zipPath, zipContent, { encoding: 'base64' });

  // Try to save to public Downloads using SAF (Storage Access Framework)
  try {
    // Request permission to access Downloads directory
    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (permissions.granted) {
      const dirUri = permissions.directoryUri;
      // Create the backup file in the selected directory
      const fileUri = await StorageAccessFramework.createFileAsync(
        dirUri,
        zipFileName,
        'application/zip'
      );
      // Write content to the file (alias for writeAsStringAsync)
      await StorageAccessFramework.writeAsStringAsync(fileUri, zipContent, {
        encoding: 'base64',
      });
      console.log('Backup saved to Downloads via SAF:', fileUri);
    } else {
      console.log('SAF permission not granted');
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

  return {
    uri: zipPath,
    diaryCount: diaries.length,
    mediaCount,
  };
};

export const importBackup = async (): Promise<{
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

  // Read ZIP file content
  const zipContent = await readAsStringAsync(zipFile.uri, { encoding: 'base64' });

  // Load ZIP
  const zip = await JSZip.loadAsync(zipContent, { base64: true });

  // Find and parse manifest
  const manifestFile = zip.file(BACKUP_MANIFEST_NAME);
  if (!manifestFile) {
    throw new Error('Invalid backup: manifest not found');
  }

  const manifestContent = await manifestFile.async('string');
  const manifest = parseBackupManifest(manifestContent);

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

    // Import each diary
    for (const diary of manifest.diaries) {
      const importedMedia: MediaItem[] = [];

      for (const media of diary.media) {
        const mediaFile = zip.file(media.relativePath);
        if (!mediaFile) {
          throw new Error(`Missing media file: ${media.relativePath}`);
        }

        // Generate new filename to avoid conflicts
        const ext = media.mimeType === 'video/mp4' ? 'mp4' : 'jpg';
        const newFileName = `${generateId()}.${ext}`;
        const destPath = `${mediaDestDir}${newFileName}`;

        // Extract and save media file
        const mediaData = await mediaFile.async('base64');
        await writeAsStringAsync(destPath, mediaData, { encoding: 'base64' });
        importedFiles.push(destPath);

        let thumbnailUri: string | undefined;
        if (media.thumbnailRelativePath) {
          const thumbFile = zip.file(media.thumbnailRelativePath);
          if (thumbFile) {
            const thumbFileName = `${generateId()}_thumb.jpg`;
            thumbnailUri = `${mediaDestDir}${thumbFileName}`;
            const thumbData = await thumbFile.async('base64');
            await writeAsStringAsync(thumbnailUri, thumbData, { encoding: 'base64' });
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

    // Delete old media files
    for (const diary of currentDiaries) {
      for (const media of diary.media) {
        await deleteMedia(media.uri);
        if (media.thumbnail) {
          await deleteMedia(media.thumbnail);
        }
      }
    }
  } catch (error) {
    // Clean up imported files on error
    for (const uri of importedFiles) {
      await deleteMedia(uri);
    }
    throw error;
  }

  return {
    diaryCount: manifest.diaries.length,
    mediaCount,
  };
};
