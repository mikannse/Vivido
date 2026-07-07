import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors, typography } from '../theme';

interface AudioPlayerProps {
  uri: string;
  /** 可选的删除入口（详情/编辑场景） */
  onDelete?: () => void;
  compact?: boolean;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * 语音附件播放器（Story 4.2）。
 * 用 useAudioPlayer 播放，显示播放/暂停与进度；
 * 组件卸载时自动释放（E9）。同一时刻由 React key/挂载数量保证只播一条。
 */
export const AudioPlayer: React.FC<AudioPlayerProps> = ({ uri, onDelete, compact }) => {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  // 卸载即释放，避免后台泄漏（E9）
  useEffect(() => {
    return () => {
      try {
        player.remove();
      } catch {
        // ignore release errors
      }
    };
  }, [player]);

  const isPlaying = status.playing;
  const duration = status.duration ?? 0;
  const currentTime = status.currentTime ?? 0;
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  const togglePlay = () => {
    if (isPlaying) {
      player.pause();
    } else {
      // 播放结束后再次点击从头播放
      if (status.didJustFinish || currentTime >= duration) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <TouchableOpacity style={styles.playButton} onPress={togglePlay} activeOpacity={0.8}>
        <Text style={styles.playIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.meta}>
          <Text style={styles.time}>{formatTime(currentTime)}</Text>
          <Text style={styles.label}>语音</Text>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
      </View>

      {onDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete} activeOpacity={0.8}>
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(210, 195, 175, 0.4)',
  },
  containerCompact: {
    padding: 8,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 15,
    color: colors.surface,
    marginLeft: 1,
  },
  body: {
    flex: 1,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: 6,
  },
  trackFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    ...typography.body,
    fontSize: 11,
    color: colors.textTertiary,
  },
  label: {
    ...typography.body,
    fontSize: 11,
    color: colors.textSecondary,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(61, 44, 30, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
