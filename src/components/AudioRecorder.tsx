import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  setAudioModeAsync,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { getInfoAsync } from 'expo-file-system/legacy';
import { colors, typography } from '../theme';

interface AudioRecorderProps {
  visible: boolean;
  onClose: () => void;
  onRecorded: (uri: string) => void;
}

// 低于此时长（或文件为空）的录音视为无效，丢弃不入库（E1）。
const MIN_DURATION_MS = 800;

const formatDuration = (millis: number): string => {
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * 语音录制入口（ADR-2 / Story 4.1）。
 * 复用 expo-audio 的 useAudioRecorder，产出 .m4a 临时文件；
 * 由父组件经 storage.saveMedia 落盘，继承现有媒体管道。
 */
export const AudioRecorder: React.FC<AudioRecorderProps> = ({ visible, onClose, onRecorded }) => {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  const isRecording = recorderState.isRecording;
  const durationMillis = recorderState.durationMillis ?? 0;

  const startRecording = useCallback(async () => {
    setPermissionDenied(false);
    setBusy(true);
    try {
      let permission = await getRecordingPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await requestRecordingPermissionsAsync();
      }
      if (!permission.granted) {
        setPermissionDenied(true);
        setBusy(false);
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      console.warn('Failed to start recording:', error);
    } finally {
      setBusy(false);
    }
  }, [recorder]);

  // 打开时自动开始录音，缩短动笔摩擦
  useEffect(() => {
    if (visible) {
      startRecording();
    }
    // 关闭时若仍在录音则中止（不保存）
    return () => {
      if (recorder.isRecording) {
        recorder.stop().catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const finalizeRecording = async (): Promise<string | null> => {
    try {
      await recorder.stop();
    } catch (error) {
      console.warn('Failed to stop recording:', error);
      return null;
    }

    const uri = recorder.uri;
    if (!uri) return null;

    // E1：时长过短视为空录音，丢弃
    if (durationMillis > 0 && durationMillis < MIN_DURATION_MS) {
      return null;
    }

    try {
      const info = await getInfoAsync(uri);
      if (!info.exists || (typeof info.size === 'number' && info.size === 0)) {
        return null;
      }
    } catch {
      // 读取失败时保守放行（文件已由录音器写入）
    }
    return uri;
  };

  const handleStop = async () => {
    setBusy(true);
    const uri = await finalizeRecording();
    setBusy(false);
    if (uri) {
      onRecorded(uri);
    }
    onClose();
  };

  const handleCancel = async () => {
    if (recorder.isRecording) {
      try {
        await recorder.stop();
      } catch {
        // ignore
      }
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {permissionDenied ? (
            <>
              <Text style={styles.title}>需要麦克风权限</Text>
              <Text style={styles.hint}>
                请在系统设置中允许 Vivido 使用麦克风，才能录制语音日记。
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={handleCancel}>
                <Text style={styles.primaryButtonText}>知道了</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>录制语音</Text>
              <View style={styles.pulse}>
                <View style={[styles.dot, isRecording && styles.dotActive]} />
              </View>
              <Text style={styles.timer}>{formatDuration(durationMillis)}</Text>
              <Text style={styles.hint}>
                {isRecording ? '正在录音…' : busy ? '准备中…' : '点击完成保存这段原声'}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleCancel} disabled={busy}>
                  <Text style={styles.secondaryButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, busy && styles.buttonDisabled]}
                  onPress={handleStop}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={colors.surface} />
                  ) : (
                    <Text style={styles.primaryButtonText}>完成</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: 300,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  title: {
    ...typography.title,
    fontSize: 18,
    color: colors.text,
    marginBottom: 16,
  },
  pulse: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(196, 112, 48, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.textTertiary,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  timer: {
    ...typography.appName,
    fontSize: 32,
    color: colors.text,
    marginBottom: 8,
  },
  hint: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    ...typography.body,
    fontSize: 15,
    color: colors.textSecondary,
  },
  primaryButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
    minWidth: 88,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...typography.body,
    fontSize: 15,
    color: colors.surface,
    fontWeight: '600',
  },
});
