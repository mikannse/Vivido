import { Directory, File } from 'expo-file-system';
import { DiaryEntry, MediaItem } from '../types';
import { generateId } from '../utils/uuid';
import { deleteMedia, saveMedia } from './storage';
import { getAllDiaries, replaceAllDiaries } from './database';
import { getMediaFileExtension } from '../utils/media';

const BACKUP_VERSION = 1;
const BACKUP_FOLDER_PREFIX = 'vivido-backup';
const BACKUP_MANIFEST_NAME = 'backup-manifest.json';
const BACKUP_MEDIA_DIRECTORY = 'media';

interface BackupManifestMedia {
  id: string;
  type: MediaItem['type'];
  relativePath: string;
  thumbnailRelativePath?: string;
  position?: number;
}

interface BackupManifestDiary {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  media: BackupManifestMedia[];
}

interface BackupManifest {
  version: number;
  exportedAt: string;
  diaries: BackupManifestDiary[];
}

export class BackupCancelledError extends Error {
  constructor() {
    super('Backup selection cancelled');
    this.name = 'BackupCancelledError';
  }
}

const ensureDirectory = (directory: Directory): void => {
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
};

const deleteIfExists = (file: File): void => {
  if (file.exists) {
    file.delete();
  }
};

const getRelativeFile = (directory: Directory, relativePath: string): File => {
  return new File(directory, ...relativePath.split('/'));
};

const isUserCancelledError = (error: unknown): boolean => {
  return error instanceof Error && /cancel/i.test(error.message);
};

const pickDirectory = async (): Promise<Directory> => {
  try {
    return await Directory.pickDirectoryAsync();
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new BackupCancelledError();
    }
    throw error;
  }
};

const buildBackupFileName = (media: MediaItem, suffix = ''): string => {
  return `${media.id}${suffix}.${getMediaFileExtension(media)}`;
};

const getBackupFileNameFromUri = (id: string, uri: string, suffix = ''): string => {
  const extensionMatch = uri.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
  const extension = extensionMatch?.[1]?.toLowerCase() ?? 'dat';
  return `${id}${suffix}.${extension}`;
};

const getImportedFileName = (relativePath: string): string => {
  const match = relativePath.split('/').pop()?.match(/\.([a-zA-Z0-9]+)$/);
  const extension = match?.[1]?.toLowerCase() ?? 'dat';
  return `${generateId()}.${extension}`;
};

const parseBackupManifest = (rawContent: string): BackupManifest => {
  const parsed = JSON.parse(rawContent) as Partial<BackupManifest>;

  if (parsed.version !== BACKUP_VERSION || !Array.isArray(parsed.diaries)) {
    throw new Error('Unsupported backup format');
  }

  return {
    version: parsed.version,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date(0).toISOString(),
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
            thumbnailRelativePath:
              typeof media.thumbnailRelativePath === 'string' ? media.thumbnailRelativePath : undefined,
            position: typeof media.position === 'number' ? media.position : undefined,
          };
        }),
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
  const destinationRoot = await pickDirectory();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDirectory = new Directory(destinationRoot, `${BACKUP_FOLDER_PREFIX}-${timestamp}`);
  const mediaDirectory = new Directory(backupDirectory, BACKUP_MEDIA_DIRECTORY);

  ensureDirectory(backupDirectory);
  ensureDirectory(mediaDirectory);

  let mediaCount = 0;
  const manifest: BackupManifest = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    diaries: diaries.map((diary) => ({
      id: diary.id,
      title: diary.title,
      content: diary.content,
      createdAt: diary.createdAt,
      updatedAt: diary.updatedAt,
      media: diary.media.map((media) => {
        const relativePath = `${BACKUP_MEDIA_DIRECTORY}/${buildBackupFileName(media)}`;
        const destinationFile = getRelativeFile(backupDirectory, relativePath);

        deleteIfExists(destinationFile);
        new File(media.uri).copy(destinationFile);

        let thumbnailRelativePath: string | undefined;
        if (media.thumbnail) {
          thumbnailRelativePath = `${BACKUP_MEDIA_DIRECTORY}/${getBackupFileNameFromUri(
            media.id,
            media.thumbnail,
            '-thumbnail'
          )}`;
          const thumbnailFile = getRelativeFile(backupDirectory, thumbnailRelativePath);
          deleteIfExists(thumbnailFile);
          new File(media.thumbnail).copy(thumbnailFile);
        }

        mediaCount += 1;

        return {
          id: media.id,
          type: media.type,
          relativePath,
          thumbnailRelativePath,
          position: media.position,
        };
      }),
    })),
  };

  const manifestFile = new File(backupDirectory, BACKUP_MANIFEST_NAME);
  deleteIfExists(manifestFile);
  manifestFile.create({ intermediates: true, overwrite: true });
  manifestFile.write(JSON.stringify(manifest, null, 2));

  return {
    uri: backupDirectory.uri,
    diaryCount: diaries.length,
    mediaCount,
  };
};

export const importBackup = async (): Promise<{
  diaryCount: number;
  mediaCount: number;
}> => {
  const backupDirectory = await pickDirectory();
  const manifestFile = new File(backupDirectory, BACKUP_MANIFEST_NAME);

  if (!manifestFile.exists) {
    throw new Error('Backup manifest not found in selected folder');
  }

  const manifest = parseBackupManifest(await manifestFile.text());
  const currentDiaries = await getAllDiaries();
  const importedFiles: string[] = [];
  let mediaCount = 0;

  try {
    const importedEntries: DiaryEntry[] = [];

    for (const diary of manifest.diaries) {
      const importedMedia: MediaItem[] = [];

      for (const media of diary.media) {
        const sourceFile = getRelativeFile(backupDirectory, media.relativePath);
        if (!sourceFile.exists) {
          throw new Error(`Missing media file: ${media.relativePath}`);
        }

        const savedUri = await saveMedia(sourceFile.uri, getImportedFileName(media.relativePath));
        importedFiles.push(savedUri);

        let thumbnailUri: string | undefined;
        if (media.thumbnailRelativePath) {
          const sourceThumbnailFile = getRelativeFile(backupDirectory, media.thumbnailRelativePath);
          if (!sourceThumbnailFile.exists) {
            throw new Error(`Missing thumbnail file: ${media.thumbnailRelativePath}`);
          }

          thumbnailUri = await saveMedia(
            sourceThumbnailFile.uri,
            getImportedFileName(media.thumbnailRelativePath)
          );
          importedFiles.push(thumbnailUri);
        }

        importedMedia.push({
          id: media.id,
          type: media.type,
          uri: savedUri,
          thumbnail: thumbnailUri,
          position: media.position,
        });
        mediaCount += 1;
      }

      importedEntries.push({
        id: diary.id,
        title: diary.title,
        content: diary.content,
        createdAt: diary.createdAt,
        updatedAt: diary.updatedAt,
        media: importedMedia,
      });
    }

    await replaceAllDiaries(importedEntries);

    for (const diary of currentDiaries) {
      for (const media of diary.media) {
        await deleteMedia(media.uri);
        if (media.thumbnail) {
          await deleteMedia(media.thumbnail);
        }
      }
    }

    return {
      diaryCount: importedEntries.length,
      mediaCount,
    };
  } catch (error) {
    for (const uri of importedFiles) {
      await deleteMedia(uri);
    }
    throw error;
  }
};
