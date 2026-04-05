const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number): string => value.toString().padStart(2, '0');

export const formatDateInputValue = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
