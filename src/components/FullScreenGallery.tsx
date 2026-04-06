import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Modal,
  TouchableOpacity,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { MediaItem } from '../types';

interface FullScreenGalleryProps {
  media: MediaItem[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
  dateInfo?: string;
}

const { width, height } = Dimensions.get('window');

const VideoPlayer = React.memo(({ uri, shouldPlay }: { uri: string; shouldPlay: boolean }) => {
  const player = useVideoPlayer(uri);

  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, shouldPlay]);

  return (
    <View style={videoStyles.container}>
      <VideoView
        player={player}
        style={videoStyles.video}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
});

const videoStyles = StyleSheet.create({
  container: {
    width: width,
    height: height * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});

export const FullScreenGallery: React.FC<FullScreenGalleryProps> = ({
  media,
  initialIndex = 0,
  visible,
  onClose,
  dateInfo,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList<MediaItem>>(null);

  useEffect(() => {
    if (visible) {
      const nextIndex = Math.min(Math.max(initialIndex, 0), Math.max(media.length - 1, 0));
      setCurrentIndex(nextIndex);

      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: false });
      });
    }
  }, [visible, initialIndex, media.length]);

  const goToNext = useCallback(() => {
    if (currentIndex < media.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }
  }, [currentIndex, media.length]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
    }
  }, [currentIndex]);

  const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (!Number.isNaN(nextIndex)) {
      setCurrentIndex(nextIndex);
    }
  }, []);

  const renderMediaItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => {
      const isVideo = item.type === 'video';

      return (
        <View style={styles.mediaPage}>
          {isVideo ? (
            <VideoPlayer uri={item.uri} shouldPlay={visible && index === currentIndex} />
          ) : (
            <Image
              source={{ uri: item.uri }}
              style={styles.fullImage}
              contentFit="contain"
            />
          )}
        </View>
      );
    },
    [currentIndex, visible]
  );

  if (!visible || media.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.controlsOverlay}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
            {dateInfo && <Text style={styles.dateText}>{dateInfo}</Text>}
          </View>

          <View style={styles.pageIndicator}>
            {media.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, index === currentIndex && styles.activeDot]}
              />
            ))}
          </View>

          <FlatList
            ref={flatListRef}
            data={media}
            renderItem={renderMediaItem}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            initialScrollIndex={Math.min(Math.max(initialIndex, 0), Math.max(media.length - 1, 0))}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            onScrollToIndexFailed={(info) => {
              console.warn('Scroll to index failed:', info);
              // Fallback: scroll to position manually
              flatListRef.current?.scrollToOffset({
                offset: info.index * width,
                animated: true,
              });
            }}
            style={styles.mediaContainer}
          />

          {currentIndex > 0 && (
            <TouchableOpacity style={styles.navButtonLeft} onPress={goToPrev}>
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>
          )}
          {currentIndex < media.length - 1 && (
            <TouchableOpacity style={styles.navButtonRight} onPress={goToNext}>
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomInfo}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {media.length}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.closeTapArea}
          onPress={onClose}
          activeOpacity={1}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(26, 23, 20, 0.98)',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  closeTapArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '300',
  },
  dateText: {
    marginLeft: 16,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'LXGWWenKaiLite',
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    zIndex: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  activeDot: {
    backgroundColor: '#c47030',
    width: 18,
  },
  mediaContainer: {
    flex: 1,
    zIndex: 10,
  },
  mediaPage: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: width,
    height: height * 0.7,
  },
  navButtonLeft: {
    position: 'absolute',
    left: 16,
    top: '50%',
    marginTop: -25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navButtonRight: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navArrow: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
  },
  bottomInfo: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingVertical: 16,
    zIndex: 10,
  },
  counterText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
});
