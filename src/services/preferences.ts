import { Storage } from 'expo-sqlite/kv-store';

// UI 偏好持久化基元（ADR-1）。
// 复用已安装的 expo-sqlite/kv-store，零新增依赖；独立于业务 diary.db，
// 不进备份、不触发业务 schema 迁移。键名规范 `pref.<域>.<项>`。
//
// getItemSync 首帧同步读，消除"先渲染默认值再跳变"，不违背"无 loading"原则。

export const PREF_KEYS = {
  homeLayout: 'pref.home.layout',
  detailMode: 'pref.detail.mode',
} as const;

/**
 * 同步读取一个字符串偏好；不存在或读取失败时返回 fallback。
 * 用于组件首帧初始化，避免布局跳变。
 */
export const getPreferenceSync = <T extends string>(key: string, fallback: T): T => {
  try {
    const value = Storage.getItemSync(key);
    return value === null ? fallback : (value as T);
  } catch (error) {
    console.warn('Failed to read preference synchronously:', key, error);
    return fallback;
  }
};

/**
 * 异步写入一个字符串偏好；失败仅告警，不阻断 UI。
 */
export const setPreference = async (key: string, value: string): Promise<void> => {
  try {
    await Storage.setItemAsync(key, value);
  } catch (error) {
    console.warn('Failed to persist preference:', key, error);
  }
};
