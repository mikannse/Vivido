import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native';
import { Image } from 'expo-image';
import { MediaItem } from '../types';
import { FullScreenGallery } from './FullScreenGallery';
import { getOrderedMedia } from '../utils/media';
import { VideoPoster } from './VideoPoster';

interface MediaViewerProps {
  media: MediaItem[];
  dateInfo?: string;
}

const { width } = Dimensions.get('window');
const IMAGE_GAP = 8;
const IMAGE_SIZE = (width - 32 - IMAGE_GAP * 2) / 3;

// Gold brand color
const BRAND_GOLD = '#c47030';

export const MediaViewer: React.FC<MediaViewerProps> = ({ media, dateInfo }) => {
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  if (media.length === 0) return null;

  const allMedia = getOrderedMedia(media);
  const images = allMedia.filter((m) => m.type === 'image');
  const videos = allMedia.filter((m) => m.type === 'video');
  const mediaIndexMap = new Map(allMedia.map((item, index) => [item.id, index]));

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryVisible(true);
  };

  // Calculate which images to show based on count
  const renderImageGrid = () => {
    if (images.length === 1) {
      const singleImageIndex = mediaIndexMap.get(images[0].id) ?? 0;

      return (
        <TouchableOpacity
          onPress={() => openGallery(singleImageIndex)}
          activeOpacity={0.9}
          style={styles.singleImageWrapper}
        >
          <Image
            source={{ uri: images[0].uri }}
            style={styles.singleImage}
            contentFit="cover"
          />
        </TouchableOpacity>
      );
    }

    if (images.length === 2) {
      return (
        <View style={styles.twoImagesRow}>
          {images.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => openGallery(mediaIndexMap.get(item.id) ?? index)}
              activeOpacity={0.9}
              style={styles.twoImageWrapper}
            >
              <Image
                source={{ uri: item.uri }}
                style={styles.twoImage}
                contentFit="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    // 3+ images - first image large, rest in corner
    return (
      <View style={styles.gridContainer}>
        {images.slice(0, 4).map((item, index) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => openGallery(mediaIndexMap.get(item.id) ?? index)}
            activeOpacity={0.9}
            style={index === 0 ? styles.gridImageLarge : styles.gridImageSmall}
          >
            <Image
              source={{ uri: item.uri }}
              style={styles.gridImage}
              contentFit="cover"
            />
            {index === 3 && images.length > 4 && (
              <View style={styles.moreOverlay}>
                <Text style={styles.moreText}>+{images.length - 4}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderVideos = () => {
    if (videos.length === 0) return null;

    return videos.map((item, index) => {
      return (
        <TouchableOpacity
          key={item.id}
          onPress={() => openGallery(mediaIndexMap.get(item.id) ?? index)}
          activeOpacity={0.9}
          style={styles.videoWrapper}
        >
          <VideoPoster
            thumbnailUri={item.thumbnail}
            style={styles.videoThumbnail}
          />
        </TouchableOpacity>
      );
    });
  };

  return (
    <>
      <View style={styles.mediaWrapper}>
        {images.length > 0 && renderImageGrid()}
        {renderVideos()}
      </View>

      <FullScreenGallery
        media={allMedia}
        initialIndex={galleryIndex}
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        dateInfo={dateInfo}
      />
    </>
  );
};

const styles = StyleSheet.create({
  mediaWrapper: {
    marginTop: 12,
  },
  singleImageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: BRAND_GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  singleImage: {
    width: width - 32,
    height: (width - 32) * 0.65,
    borderRadius: 12,
  },
  twoImagesRow: {
    flexDirection: 'row',
    gap: IMAGE_GAP,
  },
  twoImageWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: BRAND_GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  twoImage: {
    width: '100%',
    height: (width - 32 - IMAGE_GAP) / 2,
    borderRadius: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IMAGE_GAP,
  },
  gridImageSmall: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: BRAND_GOLD,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  gridImageLarge: {
    width: IMAGE_SIZE * 2 + IMAGE_GAP,
    height: IMAGE_SIZE * 2 + IMAGE_GAP,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: BRAND_GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  moreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  moreText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
  videoWrapper: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: BRAND_GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  videoThumbnail: {
    width: width - 32,
    height: (width - 32) * 0.56,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
});
