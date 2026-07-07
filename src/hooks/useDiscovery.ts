import { useState, useCallback, useEffect, useRef } from 'react';
import { DiaryEntry, Tag, TimeFilter, WordFrequency, MonthFilter } from '../types';
import {
  searchDiaries,
  getAllTags,
  getWordFrequency,
} from '../services/database';

const DEBOUNCE_MS = 300;

interface UseDiscoveryReturn {
  // State
  diaries: DiaryEntry[];
  tags: Tag[];
  wordCloudData: WordFrequency[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedTags: string[];
  timeFilter: TimeFilter;
  selectedDate: string | null;
  monthFilter: MonthFilter | null;

  // Actions
  setSearchQuery: (query: string) => void;
  setTimeFilter: (filter: TimeFilter) => void;
  toggleTag: (tagId: string) => void;
  clearTags: () => void;
  selectDate: (date: string | null) => void;
  setMonthFilter: (filter: MonthFilter | null) => void;
  clearFilters: () => void;
  refresh: () => Promise<void>;
}

export const useDiscovery = (): UseDiscoveryReturn => {
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [wordCloudData, setWordCloudData] = useState<WordFrequency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQueryState] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [timeFilter, setTimeFilterState] = useState<TimeFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [monthFilter, setMonthFilterState] = useState<MonthFilter | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const fetchData = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    if (!isMountedRef.current) return;
    setIsLoading(true);
    setError(null);

    try {
      const [diariesResult, tagsResult, wordFreqResult] = await Promise.all([
        searchDiaries(debouncedSearchQuery, selectedTags, timeFilter, selectedDate, monthFilter),
        getAllTags(),
        getWordFrequency(1, debouncedSearchQuery, selectedTags, timeFilter, selectedDate, monthFilter),
      ]);

      if (!isMountedRef.current || fetchId !== fetchIdRef.current) return;

      setDiaries(diariesResult);
      setTags(tagsResult);

      // Convert word frequency to WordFrequency with levels
      // 最低频次门槛 2：过滤只出现一次的噪声碎片词（#10）。
      const MIN_FREQ = 2;
      const sortedWords = Array.from(wordFreqResult.entries())
        .filter(([, count]) => count >= MIN_FREQ)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

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
      if (isMountedRef.current && fetchId === fetchIdRef.current) {
        setError('加载数据失败');
      }
    } finally {
      if (isMountedRef.current && fetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [debouncedSearchQuery, selectedDate, selectedTags, timeFilter, monthFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
  }, []);

  const setTimeFilter = useCallback((filter: TimeFilter) => {
    setTimeFilterState(filter);
    setSelectedDate(null);
    setMonthFilterState(null);
  }, []);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  const clearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  const selectDate = useCallback((date: string | null) => {
    setSelectedDate(date);
    setMonthFilterState(null);
    if (date) {
      setTimeFilterState('all');
    }
  }, []);

  const setMonthFilter = useCallback((filter: MonthFilter | null) => {
    setMonthFilterState(filter);
    setSelectedDate(null);
    if (filter) {
      setTimeFilterState('all');
    }
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQueryState('');
    setSelectedTags([]);
    setTimeFilterState('all');
    setSelectedDate(null);
    setMonthFilterState(null);
  }, []);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    diaries,
    tags,
    wordCloudData,
    isLoading,
    error,
    searchQuery,
    selectedTags,
    timeFilter,
    selectedDate,
    monthFilter,
    setSearchQuery,
    setTimeFilter,
    toggleTag,
    clearTags,
    selectDate,
    setMonthFilter,
    clearFilters,
    refresh,
  };
};