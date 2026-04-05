import { useState, useCallback, useEffect } from 'react';
import { DiaryEntry, Tag, TimeFilter, WordFrequency } from '../types';
import {
  searchDiaries,
  getAllTags,
  getHeatmapData,
  getWordFrequency,
} from '../services/database';

interface UseDiscoveryReturn {
  // State
  diaries: DiaryEntry[];
  tags: Tag[];
  heatmapData: Map<string, number>;
  wordCloudData: WordFrequency[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedTags: string[];
  timeFilter: TimeFilter;

  // Actions
  setSearchQuery: (query: string) => void;
  setTimeFilter: (filter: TimeFilter) => void;
  toggleTag: (tagId: string) => void;
  clearFilters: () => void;
  refresh: () => Promise<void>;
}

export const useDiscovery = (): UseDiscoveryReturn => {
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());
  const [wordCloudData, setWordCloudData] = useState<WordFrequency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQueryState] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [timeFilter, setTimeFilterState] = useState<TimeFilter>('all');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [diariesResult, tagsResult, heatmapResult, wordFreqResult] = await Promise.all([
        searchDiaries(searchQuery, selectedTags, timeFilter),
        getAllTags(),
        getHeatmapData(365),
        getWordFrequency(1),
      ]);

      setDiaries(diariesResult);
      setTags(tagsResult);
      setHeatmapData(heatmapResult);

      // Convert word frequency to WordFrequency with levels
      const sortedWords = Array.from(wordFreqResult.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30);

      const maxCount = sortedWords.length > 0 ? sortedWords[0][1] : 1;
      const wordCloud: WordFrequency[] = sortedWords.map(([word, count]) => {
        const ratio = count / maxCount;
        let level: 1 | 2 | 3 = 1;
        if (ratio > 0.6) level = 3;
        else if (ratio > 0.3) level = 2;

        return { word, count, level };
      });

      setWordCloudData(wordCloud);
    } catch (err) {
      console.error('Failed to fetch discovery data:', err);
      setError('加载数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedTags, timeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
  }, []);

  const setTimeFilter = useCallback((filter: TimeFilter) => {
    setTimeFilterState(filter);
  }, []);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQueryState('');
    setSelectedTags([]);
    setTimeFilterState('all');
  }, []);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    diaries,
    tags,
    heatmapData,
    wordCloudData,
    isLoading,
    error,
    searchQuery,
    selectedTags,
    timeFilter,
    setSearchQuery,
    setTimeFilter,
    toggleTag,
    clearFilters,
    refresh,
  };
};