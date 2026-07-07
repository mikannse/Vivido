const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number): string => value.toString().padStart(2, '0');

export const formatDateInputValue = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const formatLocalDateKey = (value: Date | number): string => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const getDateRangeForKey = (
  value: string
): { start: number; end: number } | null => {
  const parsed = parseDateInputValue(value);
  if (parsed === null) {
    return null;
  }

  const startDate = new Date(parsed);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  endDate.setMilliseconds(-1);

  return {
    start: startDate.getTime(),
    end: endDate.getTime(),
  };
};

export const parseDateInputValue = (
  value: string,
  referenceTimestamp: number = Date.now()
): number | null => {
  const match = value.trim().match(DATE_INPUT_PATTERN);

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const referenceDate = new Date(referenceTimestamp);
  const parsed = new Date(
    year,
    month - 1,
    day,
    referenceDate.getHours(),
    referenceDate.getMinutes(),
    referenceDate.getSeconds(),
    referenceDate.getMilliseconds()
  );

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed.getTime();
};

export const getWeekDayLabel = (value: string): string => {
  const parsed = parseDateInputValue(value);
  if (parsed === null) {
    return '日期无效';
  }

  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return weekdays[new Date(parsed).getDay()];
};

const startOfDay = (date: Date): number => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * 将时间戳归入一个轻量的自然时间分组标签（今天/昨天/本周/上个月……），
 * 用于首页时间线的分隔线。纯本地日历计算，无第三方依赖。
 */
export const getRelativeTimeGroup = (
  timestamp: number,
  now: number = Date.now()
): string => {
  const today = new Date(now);
  const target = new Date(timestamp);

  const dayDiff = Math.round((startOfDay(today) - startOfDay(target)) / 86400000);

  if (dayDiff <= 0) return '今天';
  if (dayDiff === 1) return '昨天';
  if (dayDiff === 2) return '前天';
  if (dayDiff < 7) return '本周';

  const sameYear = target.getFullYear() === today.getFullYear();
  const monthDiff =
    (today.getFullYear() - target.getFullYear()) * 12 +
    (today.getMonth() - target.getMonth());

  if (monthDiff === 0) return '本月';
  if (monthDiff === 1) return '上个月';
  if (sameYear) return `${target.getMonth() + 1}月`;
  return `${target.getFullYear()}年${target.getMonth() + 1}月`;
};

