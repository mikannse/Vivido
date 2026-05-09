import { MediaItem } from '../types';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
};

export const getExtensionFromValue = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const sanitized = value.split('?')[0];
  const match = sanitized.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : null;
};

export const assignMediaPositions = <T extends MediaItem>(media: T[]): T[] => {
  return media.map((item, index) => ({
    ...item,
    position: index,
  }));
};

export const getOrderedMedia = <T extends MediaItem>(media: T[]): T[] => {
  return [...media]
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftPosition = left.item.position ?? left.index;
      const rightPosition = right.item.position ?? right.index;
      return leftPosition - rightPosition;
    })
    .map(({ item }) => item);
};

// Check if media item is a GIF
export const isGif = (item: Pick<MediaItem, 'uri' | 'fileName' | 'mimeType'>): boolean => {
  if (item.mimeType?.toLowerCase().includes('gif')) return true;
  if (item.fileName?.toLowerCase().endsWith('.gif')) return true;
  if (item.uri.toLowerCase().endsWith('.gif')) return true;
  return false;
};

// Get media file extension, with special handling for GIF
export const getMediaFileExtension = (item: Pick<MediaItem, 'type' | 'uri' | 'fileName' | 'mimeType'>): string => {
  // Check for GIF first
  if (isGif(item)) return 'gif';

  return (
    getExtensionFromValue(item.fileName) ??
    getExtensionFromValue(item.uri) ??
    (item.mimeType ? MIME_EXTENSION_MAP[item.mimeType] : null) ??
    (item.type === 'video' ? 'mp4' : 'jpg')
  );
};
