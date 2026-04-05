// Type definitions for Diary App

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
  createdAt: number;
  updatedAt: number;
}

export type RootStackParamList = {
  Home: undefined;
  Editor: { diaryId?: string };
  Detail: { diaryId: string };
  Settings: undefined;
};
