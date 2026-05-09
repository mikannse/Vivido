import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { Image } from 'expo-image';
import { MediaItem } from '../types';
import { getOrderedMedia } from '../utils/media';
import { VideoPoster } from './VideoPoster';

interface TimelineCardProps {
  diary: {
    id: string;
    title: string;
    content: string;
    media: MediaItem[];
    createdAt: number;
  };
  onPress: () => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
const MEDIA_HEIGHT = CARD_WIDTH * 0.55;

// Brand colors
const BRAND_GOLD = '#c47030';
const TEXT_PRIMARY = '#3d2c1e';
const TEXT_SECONDARY = '#827066';

const formatMonthDay = (timestamp: number): { day: string; month: string } => {
  const date = new Date(timestamp);
  return {
    day: date.getDate().toString().padStart(2, '0'),
    month: `${date.getMonth() + 1}月`,
  };
};

const formatWeekDay = (timestamp: number): string => {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return weekdays[new Date(timestamp).getDay()];
};

// Single full-width image layout
const SingleMediaLayout = ({ uri, onPress }: { uri: string; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.95}>
    <Image source={{ uri }} style={styles.singleMedia} contentFit="cover" />
  </TouchableOpacity>
);

// Two images side by side
const DuoMediaLayout = ({
  media,
  onPress,
}: {
  media: MediaItem[];
  onPress: () => void;
}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.95} style={styles.duoContainer}>
    <Image source={{ uri: media[0].uri }} style={styles.duoImage} contentFit="cover" />
    <Image source={{ uri: media[1].uri }} style={styles.duoImage} contentFit="cover" />
  </TouchableOpacity>
);

// Grid collage: 1 large + 2 small
const CollageLayout = ({
  media,
  onPress,
}: {
  media: MediaItem[];
  onPress: () => void;
}) => {
  const mainImage = media[0];
  const subImages = media.slice(1, 3);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.95} style={styles.collageContainer}>
      <Image source={{ uri: mainImage.uri }} style={styles.collageMain} contentFit="cover" />
      <View style={styles.collageSubContainer}>
        {subImages.map((item) => (
          <Image
            key={item.id}
            source={{ uri: item.uri }}
            style={styles.collageSub}
            contentFit="cover"
          />
        ))}
      </View>
    </TouchableOpacity>
  );
};

// Video indicator overlay
const VideoIndicator = () => (
  <View style={styles.videoIndicator}>
    <View style={styles.goldCircle}>
      <Text style={styles.playIcon}>▶</Text>
    </View>
  </View>
);

// Artistic date display
const ArtisticDate = ({ timestamp }: { timestamp: number }) => {
  const { day, month } = formatMonthDay(timestamp);
  const weekDay = formatWeekDay(timestamp);

  return (
    <View style={styles.artisticDate}>
      <Text style={styles.dayNumber}>{day}</Text>
      <View style={styles.dateRight}>
        <Text style={styles.monthText}>{month}</Text>
        <Text style={styles.weekDayText}>{weekDay}</Text>
      </View>
    </View>
  );
};

export const TimelineCard: React.FC<TimelineCardProps> = ({ diary, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const orderedMedia = getOrderedMedia(diary.media);
  const images = orderedMedia.filter((m) => m.type === 'image');
  const videos = orderedMedia.filter((m) => m.type === 'video');
  const hasVideo = videos.length > 0;
  const totalMedia = orderedMedia.length;

  const previewContent =
    diary.content.length > 60 ? diary.content.slice(0, 60) + '...' : diary.content;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  const renderMedia = () => {
    if (totalMedia === 0) return null;

    if (images.length === 1) {
      return <SingleMediaLayout uri={images[0].uri} onPress={onPress} />;
    }

    if (images.length === 2) {
      return <DuoMediaLayout media={images.slice(0, 2)} onPress={onPress} />;
    }

    // 3+ images - collage
    return <CollageLayout media={images.slice(0, 3)} onPress={onPress} />;
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {/* Full-width media */}
        {images.length > 0 && (
          <View style={styles.mediaContainer}>
            {renderMedia()}
            {hasVideo && <VideoIndicator />}
          </View>
        )}

        {/* Video only card */}
        {images.length === 0 && videos.length > 0 && (
          <View style={styles.mediaContainer}>
            <VideoPoster
              thumbnailUri={videos[0].thumbnail}
              videoUri={videos[0].uri}
              enableGeneratedThumbnail
              style={styles.singleMedia}
            />
          </View>
        )}

        {/* Content area */}
        <View style={styles.content}>
          {/* Artistic date */}
          <ArtisticDate timestamp={diary.createdAt} />

          {/* Text content */}
          <View style={styles.textContent}>
            <Text style={styles.title} numberOfLines={1}>
              {diary.title || '无标题'}
            </Text>
            {previewContent && (
              <Text style={styles.preview} numberOfLines={2}>
                {previewContent}
              </Text>
            )}
          </View>

          {/* Media count badge */}
          {totalMedia > 0 && (
            <View style={styles.mediaCountBadge}>
              <Text style={styles.mediaCountText}>{totalMedia}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    backgroundColor: '#fdfcfb',
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(210, 195, 175, 0.3)',
    shadowColor: TEXT_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  mediaContainer: {
    width: '100%',
    height: MEDIA_HEIGHT,
    position: 'relative',
  },
  singleMedia: {
    width: '100%',
    height: '100%',
  },
  duoContainer: {
    flexDirection: 'row',
    height: '100%',
    gap: 2,
  },
  duoImage: {
    flex: 1,
    height: '100%',
  },
  collageContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  collageMain: {
    flex: 2,
    height: '100%',
  },
  collageSubContainer: {
    flex: 1,
    gap: 2,
  },
  collageSub: {
    flex: 1,
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  goldCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND_GOLD,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  playIcon: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 2,
  },
  content: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  artisticDate: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 14,
  },
  dayNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: BRAND_GOLD,
    fontFamily: 'PlayfairDisplay',
    lineHeight: 32,
  },
  dateRight: {
    marginLeft: 6,
  },
  monthText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontFamily: 'LXGWWenKaiLite',
  },
  weekDayText: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontFamily: 'LXGWWenKaiLite',
    marginTop: 1,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    fontFamily: 'SmileySans',
    marginBottom: 6,
    lineHeight: 22,
  },
  preview: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontFamily: 'LXGWWenKaiLite',
    lineHeight: 20,
  },
  mediaCountBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(196, 112, 48, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  mediaCountText: {
    fontSize: 12,
    color: BRAND_GOLD,
    fontWeight: '600',
  },
});
