import React, { useState, useCallback, useRef } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList, DiaryEntry } from '../types';
import { getDiariesPaginated } from '../services/database';
import { TimelineCard } from '../components/TimelineCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// Pagination settings
const PAGE_SIZE = 20;
const CACHE_TTL_MS = 1000;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Cache refs to avoid redundant loads and stale closures
  const lastLoadTimeRef = useRef<number>(0);
  const isLoadingRef = useRef(false);
  const currentPageRef = useRef(0);
  const diariesRef = useRef(diaries);
  diariesRef.current = diaries;

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

  const renderItem = ({ item }: { item: DiaryEntry }) => (
    <TimelineCard
      diary={item}
      onPress={() => navigation.navigate('Detail', { diaryId: item.id })}
    />
  );

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
