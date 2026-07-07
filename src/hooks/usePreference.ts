import { useState, useCallback } from 'react';
import { getPreferenceSync, setPreference } from '../services/preferences';

/**
 * 泛型 UI 偏好 hook（ADR-1）。
 *
 * - 首帧用 `getItemSync` 同步取值初始化，消除"默认→实际"的布局跳变。
 * - 写入走异步，落盘 kv-store（独立于业务库、不进备份）。
 * - 值域为字符串字面量联合类型（如 'timeline' | 'carousel'）。
 *
 * @param key 偏好键，遵循 `pref.<域>.<项>` 规范（见 PREF_KEYS）
 * @param fallback 无持久化值时的默认值
 */
export function usePreference<T extends string>(
  key: string,
  fallback: T
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => getPreferenceSync(key, fallback));

  const update = useCallback(
    (next: T) => {
      setValue(next);
      void setPreference(key, next);
    },
    [key]
  );

  return [value, update];
}
