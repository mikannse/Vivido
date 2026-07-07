import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text, RefreshControl, ActivityIndicator, Dimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList, DiaryEntry } from '../types';
import { getDiariesPaginated } from '../services/database';
import { getRelativeTimeGroup } from '../utils/date';
import { usePreference } from '../hooks/usePreference';
import { PREF_KEYS } from '../services/preferences';
import { colors, typography } from '../theme';
import { TimelineCard } from '../components/TimelineCard';
import { CarouselCard } from '../components/CarouselCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

type HomeLayout = 'timeline' | 'carousel';

// Pagination settings
const PAGE_SIZE = 20;
const CACHE_TTL_MS = 1000;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [layout, setLayout] = usePreference<HomeLayout>(PREF_KEYS.homeLayout, 'timeline');

  // Cache refs to avoid redundant loads and stale closures
  const lastLoadTimeRef = useRef<number>(0);
  const isLoadingRef = useRef(false);
  const currentPageRef = useRef(0);
  const diariesRef = useRef(diaries);
  diariesRef.current = diaries;

  // 为每个条目计算是否需要在其上方显示时间分隔线：与上一条不同分组时显示。
  // 数据按 createdAt DESC 拼接，分页追加后此比较天然延续、不重复不错位。
  const sectionHeaders = useMemo(() => {
    const now = Date.now();
    let prevGroup: string | null = null;
    return diaries.map((diary) => {
      const group = getRelativeTimeGroup(diary.createdAt, now);
      const header = group === prevGroup ? null : group;
      prevGroup = group;
      return header;
    });
  }, [diaries]);

  const loadDiariesPage = useCallback(async (page: number, force = false) => {
    if (isLoadingRef.current && !force && page > 0) return;

    const now = Date.now();

    // For initial load, use cache if valid
    if (page === 0 && !force && diariesRef.current.length > 0 && (now - lastLoadTimeRef.current) < CACHE_TTL_MS) {
      return;
    }

    isLoadingRef.current = true;
    try {
      const { diaries: newDiaries } = await getDiariesPaginated(PAGE_SIZE, page * PAGE_SIZE);

      if (page === 0) {
        setDiaries(newDiaries);
      } else {
        setDiaries(prev => [...prev, ...newDiaries]);
      }

      setHasMore(newDiaries.length === PAGE_SIZE);
      currentPageRef.current = page;
      lastLoadTimeRef.current = Date.now();
    } catch (error) {
      console.error('Failed to load diaries:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  // Initial load on focus
  useFocusEffect(
    useCallback(() => {
      currentPageRef.current = 0;
      loadDiariesPage(0, true);
    }, [loadDiariesPage])
  );

  // Load more when scrolling to bottom
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    await loadDiariesPage(currentPageRef.current + 1);
    setLoadingMore(false);
  }, [loadingMore, hasMore, loadDiariesPage]);

  const onRefresh = async () => {
    setRefreshing(true);
    currentPageRef.current = 0;
    await loadDiariesPage(0, true);
    setRefreshing(false);
  };

  const renderItem = ({ item, index }: { item: DiaryEntry; index: number }) => {
    const header = sectionHeaders[index];
    return (
      <View>
        {header ? (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{header}</Text>
          </View>
        ) : null}
        <TimelineCard
          diary={item}
          onPress={() => navigation.navigate('Detail', { diaryId: item.id })}
        />
      </View>
    );
  };

  const renderCarouselItem = ({ item }: { item: DiaryEntry }) => (
    <CarouselCard
      diary={item}
      width={SCREEN_WIDTH}
      onPress={() => navigation.navigate('Detail', { diaryId: item.id })}
    />
  );

  const toggleLayout = () => {
    setLayout(layout === 'timeline' ? 'carousel' : 'timeline');
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>还没有日记</Text>
      <Text style={styles.emptySubtitle}>点击右下角按钮开始写日记</Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#c47030" />
        <Text style={styles.footerText}>加载更多...</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vivido</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={toggleLayout}
            accessibilityLabel="切换浏览布局"
          >
            <Text style={styles.headerIcon}>{layout === 'timeline' ? '▦' : '☰'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Discovery')}
          >
            <Text style={styles.headerIcon}>◎</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      {layout === 'carousel' ? (
        <FlatList
          data={diaries}
          renderItem={renderCarouselItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselList}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#827066"
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
        />
      ) : (
        <FlatList
          data={diaries}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#827066"
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Editor', {})}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f6f3',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8f6f3',
    borderBottomWidth: 1,
    borderBottomColor: '#e2ddd8',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '600',
    color: '#3d2c1e',
    fontFamily: 'PlayfairDisplay',
    letterSpacing: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ebe7e3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 20,
    color: '#827066',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ebe7e3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 20,
    color: '#827066',
  },
  list: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  carouselList: {
    alignItems: 'center',
    paddingVertical: 8,
    flexGrow: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textTertiary,
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: '#a89080',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3d2c1e',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#827066',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#c47030',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3d2c1e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: 28,
    color: '#fdfcfb',
    fontWeight: '300',
    marginTop: -2,
  },
});
