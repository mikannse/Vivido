import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { MediaItem, Tag } from '../types';
import { getOrderedMedia } from '../utils/media';
import { VideoPoster } from './VideoPoster';
import { colors, typography } from '../theme';

interface CarouselCardProps {
  diary: {
    id: string;
    title: string;
    content: string;
    media: MediaItem[];
    tags: Tag[];
    createdAt: number;
  };
  width: number;
  onPress: () => void;
}

const formatFullDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date
    .getDate()
    .toString()
    .padStart(2, '0')}日 · ${weekdays[date.getDay()]}`;
};

/**
 * 卡片轮播布局的大图单焦点卡片（决策 2026-07-07：独立组件，不复用 TimelineCard）。
 * 一屏一张、翻阅回忆的心态。颜色/字体走 theme token。
 */
export const CarouselCard: React.FC<CarouselCardProps> = ({ diary, width, onPress }) => {
  const orderedMedia = getOrderedMedia(diary.media);
  const cover = orderedMedia[0];
  const isVideoCover = cover?.type === 'video';

  return (
    <View style={[styles.wrapper, { width }]}>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
        <View style={styles.mediaArea}>
          {cover ? (
            isVideoCover ? (
              <VideoPoster
                thumbnailUri={cover.thumbnail}
                videoUri={cover.uri}
                enableGeneratedThumbnail
                style={styles.media}
              />
            ) : (
              <Image source={{ uri: cover.uri }} style={styles.media} contentFit="cover" />
            )
          ) : (
            <View style={styles.mediaPlaceholder}>
              <Text style={styles.placeholderText}>
                {diary.content.slice(0, 40) || '无内容'}
              </Text>
            </View>
          )}
          {orderedMedia.length > 1 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{orderedMedia.length}</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.date}>{formatFullDate(diary.createdAt)}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {diary.title || '无标题'}
          </Text>
          {diary.content ? (
            <Text style={styles.preview} numberOfLines={cover ? 2 : 5}>
              {diary.content}
            </Text>
          ) : null}

          {diary.tags.length > 0 && (
            <View style={styles.tagRow}>
              {diary.tags.slice(0, 4).map((tag) => (
                <View key={tag.id} style={styles.tagPill}>
                  <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                  <Text style={styles.tagText}>{tag.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(210, 195, 175, 0.35)',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  mediaArea: {
    width: '100%',
    height: height * 0.42,
    position: 'relative',
    backgroundColor: colors.background,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: colors.background,
  },
  placeholderText: {
    ...typography.body,
    fontSize: 18,
    color: colors.textSecondary,
    lineHeight: 30,
    textAlign: 'center',
  },
  countBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(61, 44, 30, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    color: colors.surface,
    fontWeight: '600',
  },
  body: {
    padding: 20,
  },
  date: {
    ...typography.body,
    fontSize: 12,
    color: colors.primary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  title: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
    marginBottom: 10,
    lineHeight: 28,
  },
  preview: {
    ...typography.body,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(196, 112, 48, 0.08)',
  },
  tagDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tagText: {
    ...typography.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
