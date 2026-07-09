// Type definitions for Diary App

export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio';
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

export interface DiaryTag {
  diaryId: string;
  tagId: string;
}

export type TimeFilter = 'week' | 'month' | 'all';

export interface WordFrequency {
  word: string;
  count: number;
  level: 1 | 2 | 3 | 4 | 5;
}

export interface MonthFilter {
  year: number;
  month: number; // 1-12
}

export type RootStackParamList = {
  Home: undefined;
  Editor: { diaryId?: string };
  Detail: { diaryId: string };
  Settings: undefined;
  Discovery: undefined;
};
