import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { DiaryEntry } from '../types';

interface DiaryCardProps {
  diary: DiaryEntry;
  onPress: () => void;
}

const formatMonthDay = (timestamp: number): { day: string; month: string } => {
  const date = new Date(timestamp);
  return {
    day: date.getDate().toString(),
    month: `${date.getMonth() + 1}月`,
  };
};

const formatWeekDay = (timestamp: number): string => {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return weekdays[new Date(timestamp).getDay()];
};

export const DiaryCard: React.FC<DiaryCardProps> = ({ diary, onPress }) => {
  const { day, month } = formatMonthDay(diary.createdAt);
  const weekDay = formatWeekDay(diary.createdAt);
  const previewContent = diary.content.slice(0, 80) + (diary.content.length > 80 ? '...' : '');
  const hasMedia = diary.media.length > 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.dateContainer}>
        <Text style={styles.dayNumber}>{day}</Text>
        <Text style={styles.monthText}>{month}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.metaRow}>
          <Text style={styles.weekDay}>{weekDay}</Text>
          {hasMedia && (
            <View style={styles.mediaBadge}>
              <Text style={styles.mediaCount}>{diary.media.length}</Text>
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {diary.title || '无标题'}
        </Text>

        <Text style={styles.preview} numberOfLines={2}>
          {previewContent || '暂无内容'}
        </Text>
      </View>

      {hasMedia && diary.media[0].type === 'image' && (
        <Image
          source={{ uri: diary.media[0].uri }}
          style={styles.thumbnail}
          contentFit="cover"
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fdfcfb',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(210, 195, 175, 0.4)',
    shadowColor: '#3d2c1e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dateContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    minWidth: 44,
  },
  dayNumber: {
    fontSize: 22,
    fontWeight: '600',
    color: '#c47030',
    lineHeight: 26,
  },
  monthText: {
    fontSize: 12,
    color: '#827066',
    marginTop: 2,
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  weekDay: {
    fontSize: 12,
    color: '#827066',
  },
  mediaBadge: {
    backgroundColor: 'rgba(196, 112, 48, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mediaCount: {
    fontSize: 11,
    color: '#c47030',
    fontWeight: '500',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3d2c1e',
    marginBottom: 4,
    fontFamily: 'SmileySans',
  },
  preview: {
    fontSize: 14,
    color: '#827066',
    lineHeight: 20,
    fontFamily: 'LXGWWenKai',
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginLeft: 12,
    backgroundColor: '#ebe7e3',
  },
});
