import { getInfoAsync, copyAsync, deleteAsync, makeDirectoryAsync, documentDirectory } from 'expo-file-system/legacy';
import { MediaItem } from '../types';

const MEDIA_DIR = documentDirectory + 'media/';

export const MEDIA_DIR_PATH = MEDIA_DIR;

export const ensureMediaDir = async (): Promise<void> => {
  const dirInfo = await getInfoAsync(MEDIA_DIR);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
  }
};

export const saveMedia = async (sourceUri: string, fileName: string): Promise<string> => {
  await ensureMediaDir();
  const destUri = MEDIA_DIR + fileName;
  await copyAsync({ from: sourceUri, to: destUri });
  return destUri;
};

export const deleteMedia = async (uri: string): Promise<void> => {
  try {
    const fileInfo = await getInfoAsync(uri);
    if (fileInfo.exists) {
      await deleteAsync(uri);
    }
  } catch (error) {
    console.warn('Failed to delete media:', error);
  }
};

export const deleteDiaryMedia = async (media: MediaItem[]): Promise<void> => {
  for (const item of media) {
    await deleteMedia(item.uri);
    if (item.thumbnail) {
      await deleteMedia(item.thumbnail);
    }
  }
};

export const getMediaDir = (): string => MEDIA_DIR;
