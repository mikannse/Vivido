import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { RootStackParamList, DiaryEntry, MediaItem } from '../types';
import { getDiaryById, deleteDiary, getAdjacentDiaryIds } from '../services/database';
import { deleteDiaryMedia } from '../services/storage';
import { FullScreenGallery } from '../components/FullScreenGallery';
import { StyledDialog } from '../components/StyledDialog';
import { getOrderedMedia } from '../utils/media';
import { VideoPoster } from '../components/VideoPoster';
import { DiaryContent } from '../components/DiaryContent';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Detail'>;
type DetailRouteProp = RouteProp<RootStackParamList, 'Detail'>;

const { width } = Dimensions.get('window');
const BRAND_GOLD = '#c47030';

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50 };
const TEXT_PRIMARY = '#3d2c1e';
const TEXT_SECONDARY = '#7a6250';
const TEXT_MUTED = '#a48a74';
const PAPER_BG = '#f5f0e6';

const formatDateFull = (timestamp: number): string => {
  const date = new Date(timestamp);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekDay = weekdays[date.getDay()];
  return `${year}年${month}月${day}日 ${weekDay}`;
};

// Artistic date header component
const ArtisticDateHeader = ({ timestamp }: { timestamp: number }) => {
  const date = new Date(timestamp);
  const day = date.getDate();
  const month = date.toLocaleDateString('zh-CN', { month: 'long' });
  const year = date.getFullYear();

  return (
    <View style={styles.artisticDateContainer}>
      <View style={styles.dateLeftColumn}>
        <Text style={styles.artisticDay}>{day}</Text>
      </View>
      <View style={styles.dateDivider} />
      <View style={styles.artisticDateRight}>
        <Text style={styles.artisticMonth}>{month}</Text>
        <Text style={styles.artisticYear}>{year}</Text>
      </View>
    </View>
  );
};

// Watermark component
const VividoWatermark = () => (
  <View style={styles.watermark}>
    <Text style={styles.watermarkText}>Vivido</Text>
  </View>
);

export const DetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DetailRouteProp>();
  const { diaryId } = route.params;

  const [diary, setDiary] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [prevDiaryId, setPrevDiaryId] = useState<string | null>(null);
  const [nextDiaryId, setNextDiaryId] = useState<string | null>(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Reset media scroll when diary changes
  useEffect(() => {
    setCurrentMediaIndex(0);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [diary?.id]);

  const loadDiary = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [data, adjacentIds] = await Promise.all([
        getDiaryById(diaryId),
        getAdjacentDiaryIds(diaryId),
      ]);
      setDiary(data);
      setPrevDiaryId(adjacentIds.prevId);
      setNextDiaryId(adjacentIds.nextId);
    } catch (error) {
      console.error('Failed to load diary:', error);
      setDiary(null);
      setLoadError('无法加载这篇日记');
    } finally {
      setLoading(false);
    }
  }, [diaryId]);

  useFocusEffect(
    useCallback(() => {
      loadDiary();
    }, [loadDiary])
  );

  const handleDelete = () => {
    setDeleteDialogVisible(true);
  };

  const confirmDelete = async () => {
    setDeleteDialogVisible(false);
    try {
      if (diary) {
        await deleteDiary(diaryId);
        await deleteDiaryMedia(diary.media);
      }
      navigation.goBack();
    } catch (error) {
      console.error('Failed to delete diary:', error);
      setErrorDialogVisible(true);
    }
  };

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryVisible(true);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentMediaIndex(viewableItems[0].index || 0);
    }
  }).current;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!diary) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.emptyTitle}>{loadError ?? '这篇日记不存在或已被删除'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryText}>返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const allMedia = getOrderedMedia(diary.media);
  const hasMedia = allMedia.length > 0;

  const renderMediaItem = ({ item, index }: { item: MediaItem; index: number }) => {
    if (item.type === 'video') {
      return (
        <TouchableOpacity
          style={styles.mediaItem}
          onPress={() => openGallery(index)}
          activeOpacity={0.95}
        >
          <VideoPoster
            thumbnailUri={item.thumbnail}
            videoUri={item.uri}
            enableGeneratedThumbnail
            style={styles.mediaImage}
          />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.mediaItem}
        onPress={() => openGallery(index)}
        activeOpacity={0.95}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.mediaImage}
          contentFit="cover"
        />
      </TouchableOpacity>
    );
  };

  const renderPageIndicator = () => {
    if (allMedia.length <= 1) return null;

    return (
      <View style={styles.pageIndicator}>
        {allMedia.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentMediaIndex && styles.activeDot,
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>← 返回</Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Editor', { diaryId })}
              style={styles.actionButton}
            >
              <Text style={styles.editText}>编辑</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
              <Text style={styles.deleteText}>删除</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {/* Immersive media section */}
          {hasMedia && (
            <View style={styles.mediaSection}>
              <FlatList
                ref={flatListRef}
                data={allMedia}
                renderItem={renderMediaItem}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={VIEWABILITY_CONFIG}
              />
              {renderPageIndicator()}
            </View>
          )}

          {/* Content cards */}
          <View style={styles.contentStack}>
            {/* Artistic date */}
            <ArtisticDateHeader timestamp={diary.createdAt} />

            {/* Title */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>{diary.title || '无标题'}</Text>
            </View>

            {/* Content */}
            {diary.content ? (
              <View style={styles.contentSection}>
                <DiaryContent content={diary.content} />
                <Text style={styles.charCount}>{diary.content.length} 字</Text>
              </View>
            ) : null}

            {/* Watermark */}
            <VividoWatermark />

            {/* Last modified */}
            {diary.updatedAt !== diary.createdAt && (
              <Text style={styles.updatedText}>
                最后修改: {formatDateFull(diary.updatedAt)}
              </Text>
            )}

            {/* Navigation buttons at bottom */}
            <View style={styles.bottomNav}>
              <TouchableOpacity
                onPress={() => prevDiaryId && navigation.navigate('Detail', { diaryId: prevDiaryId })}
                disabled={!prevDiaryId}
                style={[styles.bottomNavButton, !prevDiaryId && styles.bottomNavButtonDisabled]}
              >
                <Text style={[styles.bottomNavText, !prevDiaryId && styles.bottomNavTextDisabled]}>◀ 上一篇</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => nextDiaryId && navigation.navigate('Detail', { diaryId: nextDiaryId })}
                disabled={!nextDiaryId}
                style={[styles.bottomNavButton, !nextDiaryId && styles.bottomNavButtonDisabled]}
              >
                <Text style={[styles.bottomNavText, !nextDiaryId && styles.bottomNavTextDisabled]}>下一篇 ▶</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>

      <FullScreenGallery
        media={allMedia}
        initialIndex={galleryIndex}
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        dateInfo={formatDateFull(diary.createdAt)}
      />

      <StyledDialog
        visible={deleteDialogVisible}
        title="确认删除"
        message="确定要删除这篇日记吗？此操作不可恢复。"
        buttons={[
          { text: '取消', style: 'cancel', onPress: () => setDeleteDialogVisible(false) },
          { text: '删除', style: 'destructive', onPress: confirmDelete },
        ]}
        onDismiss={() => setDeleteDialogVisible(false)}
      />

      <StyledDialog
        visible={errorDialogVisible}
        title="错误"
        message="删除失败"
        buttons={[
          { text: '确定', style: 'default', onPress: () => setErrorDialogVisible(false) },
        ]}
        onDismiss={() => setErrorDialogVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER_BG,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: TEXT_SECONDARY,
  },
  emptyTitle: {
    fontSize: 16,
    color: TEXT_PRIMARY,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: BRAND_GOLD,
  },
  retryText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  blurBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  blurImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fallbackBg: {
    backgroundColor: '#2a2118',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    paddingVertical: 4,
  },
  backText: {
    fontSize: 16,
    color: TEXT_PRIMARY,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 20,
  },
  navButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  navButton: {
    paddingVertical: 4,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 14,
    color: BRAND_GOLD,
    fontWeight: '500',
  },
  navButtonTextDisabled: {
    color: TEXT_MUTED,
  },
  actionButton: {
    paddingVertical: 4,
  },
  editText: {
    fontSize: 16,
    color: BRAND_GOLD,
  },
  deleteText: {
    fontSize: 16,
    color: 'rgba(61,44,30,0.6)',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
  },
  mediaSection: {
    marginBottom: 24,
  },
  mediaItem: {
    width: width,
    height: width * 0.75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goldPlayButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: BRAND_GOLD,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  playIcon: {
    fontSize: 28,
    color: '#fff',
    marginLeft: 4,
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  activeDot: {
    backgroundColor: BRAND_GOLD,
    width: 20,
  },
  contentStack: {
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  artisticDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  dateLeftColumn: {
    alignItems: 'flex-end',
  },
  artisticDay: {
    fontSize: 64,
    fontWeight: '700',
    color: BRAND_GOLD,
    fontFamily: 'PlayfairDisplay',
    lineHeight: 72,
  },
  dateDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(196, 112, 48, 0.2)',
    marginHorizontal: 14,
  },
  artisticDateRight: {
    paddingBottom: 4,
  },
  artisticMonth: {
    fontSize: 20,
    color: TEXT_SECONDARY,
    fontFamily: 'LXGWWenKaiLite',
  },
  artisticYear: {
    fontSize: 16,
    color: TEXT_MUTED,
    fontFamily: 'LXGWWenKaiLite',
    marginTop: 4,
  },
  titleSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(196, 112, 48, 0.15)',
  },
  contentSection: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    lineHeight: 38,
    fontFamily: 'LXGWWenKaiLite',
    letterSpacing: 1,
  },
  contentText: {
    fontSize: 17,
    color: TEXT_PRIMARY,
    lineHeight: 32,
    fontFamily: 'LXGWWenKaiLite',
    letterSpacing: 0.3,
  },
  watermark: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  watermarkText: {
    fontSize: 14,
    color: 'rgba(196, 112, 48, 0.35)',
    fontFamily: 'PlayfairDisplay',
    letterSpacing: 2,
  },
  updatedText: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  charCount: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'right',
    marginTop: 12,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    marginTop: 32,
    marginBottom: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 112, 48, 0.12)',
  },
  bottomNavButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  bottomNavButtonDisabled: {
    opacity: 0.4,
  },
  bottomNavText: {
    fontSize: 15,
    color: BRAND_GOLD,
    fontWeight: '500',
  },
  bottomNavTextDisabled: {
    color: TEXT_MUTED,
  },
  bottomPadding: {
    height: 40,
  },
});
