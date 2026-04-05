import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer } from 'expo-video';
import type { SharedRefType } from 'expo';

interface VideoPosterProps {
  thumbnailUri?: string;
  videoUri?: string;
  style?: StyleProp<ViewStyle>;
  label?: string;
  enableGeneratedThumbnail?: boolean;
}

export const VideoPoster: React.FC<VideoPosterProps> = ({
  thumbnailUri,
  videoUri,
  style,
  label = '视频',
  enableGeneratedThumbnail = false,
}) => {
  const shouldGenerateThumbnail =
    enableGeneratedThumbnail && !thumbnailUri && Boolean(videoUri) && Platform.OS !== 'web';
  const player = useVideoPlayer(shouldGenerateThumbnail ? videoUri ?? null : null);
  const [generatedThumbnail, setGeneratedThumbnail] = useState<SharedRefType<'image'> | null>(null);
  const generatedThumbnailRef = useRef<SharedRefType<'image'> | null>(null);

  const replaceGeneratedThumbnail = useCallback((nextThumbnail: SharedRefType<'image'> | null) => {
    const previousThumbnail = generatedThumbnailRef.current as { release?: () => void } | null;

    if (previousThumbnail && previousThumbnail !== nextThumbnail) {
      previousThumbnail.release?.();
    }

    generatedThumbnailRef.current = nextThumbnail;
    setGeneratedThumbnail(nextThumbnail);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!shouldGenerateThumbnail) {
      replaceGeneratedThumbnail(null);
      return;
    }

    const generateThumbnail = async () => {
      try {
        const thumbnails = await player.generateThumbnailsAsync([0.1], {
          maxWidth: 1200,
          maxHeight: 1200,
        });

        const firstThumbnail = thumbnails[0] ?? null;

        if (cancelled) {
          (firstThumbnail as { release?: () => void } | null)?.release?.();
          return;
        }

        replaceGeneratedThumbnail(firstThumbnail);
      } catch (error) {
        if (!cancelled) {
          replaceGeneratedThumbnail(null);
        }
      }
    };

    generateThumbnail();

    return () => {
      cancelled = true;
    };
  }, [player, replaceGeneratedThumbnail, shouldGenerateThumbnail]);

  useEffect(() => {
    return () => {
      const currentThumbnail = generatedThumbnailRef.current as { release?: () => void } | null;
      currentThumbnail?.release?.();
      generatedThumbnailRef.current = null;
    };
  }, []);

  const imageSource = thumbnailUri ? { uri: thumbnailUri } : generatedThumbnail;

  return (
    <View style={[styles.container, style]}>
      {imageSource ? (
        <Image source={imageSource} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>{label}</Text>
          <Text style={styles.fallbackSubtitle}>点击播放</Text>
        </View>
      )}

      <View style={styles.overlay}>
        <View style={styles.playButton}>
          <Text style={styles.playIcon}>▶</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#231b16',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#231b16',
  },
  fallbackTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  fallbackSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(196, 112, 48, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 6,
  },
  playIcon: {
    color: '#fff',
    fontSize: 24,
    marginLeft: 4,
  },
});
