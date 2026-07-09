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
/**
 * 将十六进制颜色转换为 rgba 字符串，用于需要 alpha 透明度的场景。
 * 同时支持 6 字符（#RRGGBB）和 3 字符（#RGB，自动扩展为 #RRGGBB）格式。
 * 用法示例：`backgroundColor: alpha(colors.primary, 0.08)`
 */
export const alpha = (hex: string, opacity: number): string => {
  // 支持 3 字符简写（#RGB → #RRGGBB）
  if (hex.length === 4) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // 当 hex 格式无效时返回透明色
  if ([r, g, b].some(isNaN)) {
    return `rgba(0, 0, 0, ${opacity})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
