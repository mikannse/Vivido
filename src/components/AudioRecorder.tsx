import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import type { RecorderState } from 'expo-audio';
import { getInfoAsync, deleteAsync } from 'expo-file-system/legacy';
import { colors, typography, alpha } from '../theme';

// 绕过 useAudioRecorder（它在渲染阶段通过 useReleasingSharedObject
// 创建原生对象，在 Android 上可能导致 "shared object already released" 崩溃）。
// 改为手动管理 AudioRecorder 生命周期，在 useEffect 中创建/释放。
// AudioModule 从 'expo-audio' 公开导出（非内部 build 路径）。

interface AudioRecorderProps {
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
 * 复用 expo-audio 底层 AudioRecorder，产出 .m4a 临时文件；
 * 由父组件经 storage.saveMedia 落盘，继承现有媒体管道。
 */
export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onClose, onRecorded }) => {
  // 用 ref 持有 recorder 实例，避免渲染阶段创建原生对象
  const recorderRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [durationMillis, setDurationMillis] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [initFailed, setInitFailed] = useState(false);

  // 挂载后创建原生 AudioRecorder（在 effect 中而非渲染阶段，避免 JSI 同步调用问题）
  useEffect(() => {
    if (!AudioModule?.AudioRecorder) {
      setInitFailed(true);
      return;
    }

    let recorder: any = null;
    try {
      // RecordingPresets.HIGH_QUALITY 在 Android 上的默认选项
      recorder = new AudioModule.AudioRecorder({
        extension: '.m4a',
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        isMeteringEnabled: false,
        android: {
          outputFormat: 'mpeg4',
          audioEncoder: 'aac',
        },
      });
      recorderRef.current = recorder;
    } catch (e) {
      console.warn('Failed to create AudioRecorder:', e);
      setInitFailed(true);
      return;
    }

    return () => {
      // 组件卸载时释放原生对象。
      // 注意：stop() 返回 Promise<void>，必须 await 后再 release()，
      // 否则 release() 可能在 stop() 完成前执行 -> 原生竞争崩溃（#1）。
      const rec = recorder; // 在当前闭包中捕获此 useEffect 创建的实例
      (async () => {
        try {
          if (rec.isRecording) {
            await rec.stop();
          }
        } catch {
          // ignore
        }
        try {
          rec.release();
        } catch {
          // ignore
        }
        // 仅在 recorderRef 仍指向同一实例时才 null out，
        // 避免快速重挂载时 IIFE 恢复后覆盖新实例的引用（#3）。
        if (recorderRef.current === rec) {
          recorderRef.current = null;
        }
      })();
    };
  }, []);

  // 轮询录音状态（在 effect 中调用 getStatus()，避免渲染阶段同步 JSI）。
  // 录音停止后自动停止轮询以节省 JSI 调用（#14）。
  useEffect(() => {
    let active = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = () => {
      if (!active) return;
      const recorder = recorderRef.current;
      if (!recorder) return;
      try {
        const status: RecorderState = recorder.getStatus();
        if (active) {
          setIsRecording(status.isRecording);
          setDurationMillis(status.durationMillis);
          // 录音已停止 -> 停止轮询
          if (!status.isRecording && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch {
        // 原生对象可能暂不可用，忽略本次轮询
      }
    };

    // 首次快速轮询（200ms）以尽快获取录音器状态
    const initialTimer = setTimeout(() => {
      poll();
      if (active) {
        intervalId = setInterval(poll, 500);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(initialTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const startRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;

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
      await recorder.record();
    } catch (error) {
      console.warn('Failed to start recording:', error);
    } finally {
      setBusy(false);
    }
  }, []);

  // 组件挂载时自动开始录音，关闭时若仍在录音则中止（不保存）
  useEffect(() => {
    if (initFailed) return;
    // 延迟一小段时间确保原生对象已就绪
    const timer = setTimeout(() => {
      startRecording();
    }, 300);
    return () => clearTimeout(timer);
  }, [initFailed, startRecording]);

  const finalizeRecording = async (): Promise<string | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    try {
      await recorder.stop();
    } catch (error) {
      console.warn('Failed to stop recording:', error);
      return null;
    }

    const uri = recorder.uri;
    if (!uri) return null;

    // E1：用时长的 final 状态而非轮询 stale 状态判断（#5）。
    // 轮询每 500ms 更新一次 duration state，stop() 后直接从 native 对象读精确值。
    let finalDuration: number = 0;
    try {
      const status = recorder.getStatus();
      finalDuration = status.durationMillis ?? 0;
    } catch {
      finalDuration = durationMillis; // fallback 到轮询值
    }
    if (finalDuration > 0 && finalDuration < MIN_DURATION_MS) {
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
    const recorder = recorderRef.current;
    if (recorder?.isRecording) {
      try {
        await recorder.stop();
      } catch {
        // ignore
      }
    }
    // 删除由 prepareToRecordAsync 创建的临时 .m4a 文件（#4）。
    if (recorder?.uri) {
      try {
        await deleteAsync(recorder.uri, { idempotent: true });
      } catch {
        // ignore
      }
    }
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {initFailed ? (
            <>
              <Text style={styles.title}>录音不可用</Text>
              <Text style={styles.hint}>
                当前设备不支持语音录制功能。
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={handleCancel}>
                <Text style={styles.primaryButtonText}>知道了</Text>
              </TouchableOpacity>
            </>
          ) : permissionDenied ? (
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
    backgroundColor: alpha(colors.text, 0.5),
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
    backgroundColor: alpha(colors.primary, 0.08),
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
