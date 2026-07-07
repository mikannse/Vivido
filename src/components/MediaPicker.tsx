import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { MediaItem } from '../types';
import { assignMediaPositions } from '../utils/media';
import { VideoPoster } from './VideoPoster';
import { AudioPlayer } from './AudioPlayer';

interface MediaPickerProps {
  media: MediaItem[];
  onMediaChange: (media: MediaItem[]) => void;
}

export const MediaPicker: React.FC<MediaPickerProps> = ({ media, onMediaChange }) => {
  const removeMedia = (id: string) => {
    onMediaChange(assignMediaPositions(media.filter((m) => m.id !== id)));
  };

  const audioItems = media.filter((m) => m.type === 'audio');
  const visualItems = media.filter((m) => m.type !== 'audio');

  return (
    <View style={styles.container}>
      {visualItems.length > 0 && (
        <ScrollView
          horizontal
          style={styles.mediaList}
          showsHorizontalScrollIndicator={false}
        >
          {visualItems.map((item) => (
            <View key={item.id} style={styles.mediaItem}>
              {item.type === 'image' ? (
                <Image
                  source={{ uri: item.uri }}
                  style={styles.mediaPreview}
                  contentFit="cover"
                />
              ) : (
                <VideoPoster
                  thumbnailUri={item.thumbnail}
                  style={styles.mediaPreview}
                />
              )}
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeMedia(item.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
              {item.type === 'video' && (
                <View style={styles.videoBadge}>
                  <Text style={styles.videoBadgeText}>视频</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {audioItems.length > 0 && (
        <View style={styles.audioList}>
          {audioItems.map((item) => (
            <AudioPlayer
              key={item.id}
              uri={item.uri}
              onDelete={() => removeMedia(item.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  mediaList: {
    marginTop: 16,
    overflow: 'visible',
  },
  audioList: {
    marginTop: 16,
    gap: 10,
  },
  mediaItem: {
    marginRight: 12,
    position: 'relative',
    overflow: 'visible',
  },
  mediaPreview: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#ebe7e3',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(61, 44, 30, 0.7)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#fdfcfb',
    fontSize: 12,
    fontWeight: '600',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(61, 44, 30, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoBadgeText: {
    color: '#fdfcfb',
    fontSize: 10,
    fontWeight: '500',
  },
});
