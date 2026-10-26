// 日记分享长图：视图截图 → 保存相册 / 系统分享 → 临时文件清理。
// 只读现有 DiaryEntry，不写业务库；临时长图落在 cacheDirectory，不进备份。
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, deleteAsync, readDirectoryAsync, copyAsync, getInfoAsync } from 'expo-file-system/legacy';
import type React from 'react';

export type CaptureTarget = number | React.ReactInstance | React.RefObject<unknown>;

export interface CaptureShareImageOptions {
  fileName?: string;
}

export type SaveImageResult =
  | { status: 'saved' }
  // 权限被拒：由 UI 引导用户前往系统设置，不崩溃
  | { status: 'denied'; canAskAgain: boolean };

const SHARE_IMAGE_FORMAT = 'jpg' as const;
const SHARE_IMAGE_QUALITY = 0.9;

// 截取分享卡片视图为 JPEG 临时文件，返回 file:// URI。
// JPEG + 0.9 质量是有意的内存缓解：长图像素大，PNG 无压缩易 OOM。
export const captureShareImage = async (
  target: CaptureTarget,
  options?: CaptureShareImageOptions
): Promise<string> => {
  const fileName = options?.fileName ?? `vivido-share-${Date.now()}`;
  return captureRef(target, {
    format: SHARE_IMAGE_FORMAT,
    quality: SHARE_IMAGE_QUALITY,
    result: 'tmpfile',
    fileName,
  });
};

// view-shot 写入的 tmpfile 可能在 cacheDirectory 之外（iOS: NSTemporaryDirectory/ReactNative；
// Android: external/internal cache 按剩余空间二选一），统一迁入 cacheDirectory，
// 使 cleanupStaleShareImages 可在两平台真实生效。
export const relocateViewShotFile = async (tempUri: string): Promise<string> => {
  if (!cacheDirectory) return tempUri;
  if (tempUri.startsWith(cacheDirectory)) return tempUri;

  const fileName = `vivido-share-${Date.now()}.jpg`;
  const dest = cacheDirectory + fileName;

  try {
    const info = await getInfoAsync(tempUri);
    if (info.exists) {
      await copyAsync({ from: tempUri, to: dest });
      await deleteAsync(tempUri, { idempotent: true });
      return dest;
    }
  } catch (error) {
    console.warn('Failed to relocate view-shot file, using original:', error);
  }
  return tempUri;
};

// 把长图写入系统相册。权限被拒时返回 denied 而非抛错。
export const saveImageToLibrary = async (uri: string): Promise<SaveImageResult> => {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) {
    return { status: 'denied', canAskAgain: permission.canAskAgain };
  }
  await MediaLibrary.createAssetAsync(uri);
  return { status: 'saved' };
};

// 打开系统分享面板。返回 false 表示设备不支持（如部分模拟器）。
export const shareImage = async (uri: string): Promise<boolean> => {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    return false;
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'image/jpeg',
    dialogTitle: '分享日记长图',
  });
  return true;
};

// 删除临时长图文件；失败静默（文件可能已被系统清理）。
export const cleanupShareImage = async (uri: string): Promise<void> => {
  if (!uri.startsWith('file://')) {
    return;
  }
  try {
    await deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.warn('Failed to cleanup share image:', error);
  }
};

// 清理 cacheDirectory 中前缀为 vivido-share- 的临时文件（由 relocateViewShotFile 迁入）。
// iOS 上原始 view-shot 文件写入 NSTemporaryDirectory/ReactNative（由 RN 下次冷启动清空），
// relocate 后副本在 cacheDirectory 内，此兜底在两平台均生效。
export const cleanupStaleShareImages = async (): Promise<void> => {
  if (!cacheDirectory) {
    return;
  }
  try {
    const entries = await readDirectoryAsync(cacheDirectory);
    await Promise.all(
      entries
        .filter((name) => name.startsWith('vivido-share-'))
        .map((name) =>
          deleteAsync(cacheDirectory + name, { idempotent: true }).catch(() => undefined)
        )
    );
  } catch (error) {
    console.warn('Failed to cleanup stale share images:', error);
  }
};
