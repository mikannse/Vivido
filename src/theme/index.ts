import { TextStyle } from 'react-native';

export const typography = {
  // 标题字体 - SmileySans
  title: {
    fontFamily: 'SmileySans',
  } as TextStyle,

  // 正文字体 - LXGWWenKai Lite
  body: {
    fontFamily: 'LXGWWenKaiLite',
  } as TextStyle,

  // 应用名称字体 - PlayfairDisplay
  appName: {
    fontFamily: 'PlayfairDisplay',
  } as TextStyle,
};

export const colors = {
  background: '#f8f6f3',
  surface: '#fdfcfb',
  primary: '#c47030',
  text: '#3d2c1e',
  textSecondary: '#827066',
  textTertiary: '#a89080',
  border: '#e2ddd8',
};

/**
 * 将十六进制颜色转换为 rgba 字符串，用于需要 alpha 透明度的场景。
 * 用法示例：`backgroundColor: alpha(colors.primary, 0.08)`
 */
export const alpha = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
