import { useState, useCallback, useEffect, useRef } from 'react';
import { DiaryEntry, Tag, TimeFilter, WordFrequency, MonthFilter } from '../types';
import {
  searchDiaries,
  getAllTags,
  getWordFrequency,
} from '../services/database';
import type { WordCount } from '../utils/wordcloud';

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
        getWordFrequency(debouncedSearchQuery, selectedTags, timeFilter, selectedDate, monthFilter),
      ]);

      if (!isMountedRef.current || fetchId !== fetchIdRef.current) return;

      setDiaries(diariesResult);
      setTags(tagsResult);

      // Convert word frequency to WordFrequency with levels
      // 原始频次（raw）用于计算 level（决定颜色/大小），加权分（weighted）仅用于排序。
      // 动词前缀/语气词后缀已在 wordcloud 层过滤，raw>=1 即可（#10 原 MIN_FREQ=2 因加权分混用导致全 level 3）。
      const MIN_FREQ = 1;
      const TOP_N = 20;

      const sortedWords = Array.from(wordFreqResult.entries())
        .filter(([, wc]) => wc.raw >= MIN_FREQ)
        .sort((a, b) => b[1].weighted - a[1].weighted)
        .slice(0, TOP_N);

      const maxRaw = sortedWords.length > 0
        ? Math.max(...sortedWords.map(([, wc]) => wc.raw))
        : 1;
      const wordCloud: WordFrequency[] = sortedWords.map(([word, wc]) => {
        const ratio = wc.raw / maxRaw;
        let level: 1 | 2 | 3 | 4 | 5 = 1;
        if (ratio > 0.8) level = 5;
        else if (ratio > 0.6) level = 4;
        else if (ratio > 0.4) level = 3;
        else if (ratio > 0.2) level = 2;

        return { word, count: wc.raw, level };
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