import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useDiscovery } from '../hooks/useDiscovery';
import { FilterChips } from '../components/FilterChips';
import { TagChip } from '../components/TagChip';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { WordCloud } from '../components/WordCloud';
import { EmptyDiscovery } from '../components/EmptyDiscovery';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Discovery'>;

const TIME_FILTER_LABELS = {
  all: '全部时间',
  week: '最近 7 天',
  month: '最近 1 个月',
  sameDayLastYear: '那年今日',
} as const;

export const DiscoveryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [showSearch, setShowSearch] = useState(false);
  const {
    diaries,
    tags,
    heatmapData,
    wordCloudData,
    isLoading,
    error,
    searchQuery,
    selectedTags,
    timeFilter,
    selectedDate,
    setSearchQuery,
    setTimeFilter,
    toggleTag,
    selectDate,
    clearFilters,
    refresh,
  } = useDiscovery();

  const handleBack = () => {
    navigation.goBack();
  };

  const handleTagSearch = (word: string) => {
    setShowSearch(true);
    setSearchQuery(word);
  };

  const handleDayPress = (date: string) => {
    selectDate(date);
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedTags.length > 0 ||
    timeFilter !== 'all' ||
    Boolean(selectedDate);
  const wordCloudTitle = hasActiveFilters ? '筛选结果关键词' : '近 30 天关键词';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>回顾岛</Text>
        <TouchableOpacity onPress={() => setShowSearch(!showSearch)}>
          <Text style={styles.searchIcon}>🔍</Text>
        </TouchableOpacity>
      </View>

      {showSearch && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索日记..."
            placeholderTextColor="#a89080"
            value={searchQuery}
            onChangeText={setSearchQuery}
            multiline={false}
            numberOfLines={1}
            scrollEnabled={false}
          />
        </View>
      )}

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#c47030" />
        }
      >
        <FilterChips selected={timeFilter} onSelect={setTimeFilter} />

        {hasActiveFilters && (
          <View style={styles.activeFilters}>
            <View style={styles.filterSummary}>
              {selectedDate ? (
                <Text style={styles.filterPill}>日期: {selectedDate}</Text>
              ) : null}
              {timeFilter !== 'all' ? (
                <Text style={styles.filterPill}>时间: {TIME_FILTER_LABELS[timeFilter]}</Text>
              ) : null}
              {searchQuery.trim() ? (
                <Text style={styles.filterPill}>关键词: {searchQuery.trim()}</Text>
              ) : null}
              {selectedTags.length > 0 ? (
                <Text style={styles.filterPill}>标签: 任一命中 {selectedTags.length} 个</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={clearFilters} activeOpacity={0.7}>
              <Text style={styles.clearFiltersText}>清空筛选</Text>
            </TouchableOpacity>
          </View>
        )}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>回顾岛数据加载失败</Text>
            <TouchableOpacity onPress={refresh} activeOpacity={0.7}>
              <Text style={styles.retryText}>重试</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {tags.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.sectionTitle}>标签筛选</Text>
            <Text style={styles.sectionHint}>多选时按“命中任一标签”筛选</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagsContainer}
            >
              {tags.map((tag) => (
                <TagChip
                  key={tag.id}
                  tag={tag}
                  selected={selectedTags.includes(tag.id)}
                  onPress={() => toggleTag(tag.id)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>生活热力图</Text>
          <ActivityHeatmap data={heatmapData} onDayPress={handleDayPress} />
        </View>

        {wordCloudData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>本月关键词</Text>
            <Text style={styles.hiddenText}>{wordCloudTitle}</Text>
            <Text style={styles.sectionHint}>{wordCloudTitle}</Text>
            <WordCloud data={wordCloudData} onWordPress={handleTagSearch} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>日记</Text>
          {diaries.length === 0 ? (
            <EmptyDiscovery type={hasActiveFilters ? 'filter' : 'general'} />
          ) : (
            <View style={styles.diaryList}>
              {diaries.map((diary) => (
                <TouchableOpacity
                  key={diary.id}
                  style={styles.diaryItem}
                  onPress={() => navigation.navigate('Detail', { diaryId: diary.id })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.diaryTitle} numberOfLines={1}>
                    {diary.title}
                  </Text>
                  <Text style={styles.diaryDate}>
                    {new Date(diary.createdAt).toLocaleDateString('zh-CN')}
                  </Text>
                  <Text style={styles.diaryPreview} numberOfLines={2}>
                    {diary.content}
                  </Text>
                  {diary.tags.length > 0 && (
                    <View style={styles.diaryTags}>
                      {diary.tags.slice(0, 3).map((tag) => (
                        <View
                          key={tag.id}
                          style={[styles.tagDot, { backgroundColor: tag.color }]}
                        />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f6f3',
    borderBottomWidth: 1,
    borderBottomColor: '#e2ddd8',
  },
  backText: {
    fontSize: 16,
    color: '#c47030',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#3d2c1e',
  },
  searchIcon: {
    fontSize: 20,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f6f3',
  },
  searchInput: {
    backgroundColor: '#fdfcfb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 0,
    height: 44,
    fontSize: 16,
    color: '#3d2c1e',
    borderWidth: 1,
    borderColor: '#e2ddd8',
  },
  content: {
    flex: 1,
  },
  activeFilters: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  filterSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  filterPill: {
    fontSize: 12,
    color: '#6e5747',
    backgroundColor: '#efe6dd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  clearFiltersText: {
    fontSize: 13,
    color: '#c47030',
    fontWeight: '600',
  },
  errorCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff4ee',
    borderWidth: 1,
    borderColor: 'rgba(196, 112, 48, 0.25)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#8a4d22',
  },
  retryText: {
    fontSize: 13,
    color: '#c47030',
    fontWeight: '600',
  },
  tagsSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#827066',
    marginBottom: 10,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagsContainer: {
    paddingVertical: 8,
  },
  sectionHint: {
    fontSize: 12,
    color: '#a89080',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  hiddenText: {
    display: 'none',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  diaryList: {
    gap: 12,
  },
  diaryItem: {
    backgroundColor: '#fdfcfb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(210, 195, 175, 0.4)',
  },
  diaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3d2c1e',
    marginBottom: 4,
  },
  diaryDate: {
    fontSize: 12,
    color: '#a89080',
    marginBottom: 8,
  },
  diaryPreview: {
    fontSize: 14,
    color: '#827066',
    lineHeight: 20,
  },
  diaryTags: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 6,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bottomPadding: {
    height: 40,
  },
});
