import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { MediaItem } from '../types';
import { generateId } from '../utils/uuid';
import { assignMediaPositions } from '../utils/media';
import { VideoPoster } from './VideoPoster';

interface MediaPickerProps {
  media: MediaItem[];
  onMediaChange: (media: MediaItem[]) => void;
}

export const MediaPicker: React.FC<MediaPickerProps> = ({ media, onMediaChange }) => {
  const requestPermission = async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    }
  };

  const pickImage = async () => {
    const hasPermission = await requestPermission('library');
    if (!hasPermission) {
      Alert.alert('权限不足', '需要访问相册权限才能选择图片');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      orderedSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newMedia: MediaItem[] = result.assets.map((asset) => ({
        id: generateId(),
        type: asset.type === 'video' ? 'video' : 'image',
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      }));
      onMediaChange(assignMediaPositions([...media, ...newMedia]));
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermission('camera');
    if (!hasPermission) {
      Alert.alert('权限不足', '需要访问相机权限才能拍照');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled) {
      const newMedia: MediaItem = {
        id: generateId(),
        type: 'image',
        uri: result.assets[0].uri,
        fileName: result.assets[0].fileName,
        mimeType: result.assets[0].mimeType,
      };
      onMediaChange(assignMediaPositions([...media, newMedia]));
    }
  };

  const removeMedia = (id: string) => {
    onMediaChange(assignMediaPositions(media.filter((m) => m.id !== id)));
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={pickImage}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonIcon}>🖼</Text>
          <Text style={styles.buttonText}>相册</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={takePhoto}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonIcon}>📷</Text>
          <Text style={styles.buttonText}>拍照</Text>
        </TouchableOpacity>
      </View>

      {media.length > 0 && (
        <ScrollView
          horizontal
          style={styles.mediaList}
          showsHorizontalScrollIndicator={false}
        >
          {media.map((item) => (
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#ebe7e3',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2ddd8',
  },
  buttonIcon: {
    fontSize: 18,
  },
  buttonText: {
    color: '#3d2c1e',
    fontSize: 15,
    fontWeight: '500',
  },
  mediaList: {
    marginTop: 16,
  },
  mediaItem: {
    marginRight: 12,
    position: 'relative',
  },
  mediaPreview: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#ebe7e3',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
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
