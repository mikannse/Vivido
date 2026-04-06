import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { formatLocalDateKey } from '../utils/date';

interface HeatmapDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface ActivityHeatmapProps {
  data: Map<string, number>;
  onDayPress?: (date: string, count: number) => void;
}

const COLORS = {
  level0: '#f8f6f3',
  level1: '#f0e6d8',
  level2: '#d4b896',
  level3: '#c47030',
  level4: '#8b4513',
};

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const DAYS = ['日', '一', '二', '三', '四', '五', '六'];

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data, onDayPress }) => {
  const { weeks, monthLabels, gridWidth } = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364); // 52 weeks ago

    // Align to start of week (Sunday)
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const weeksArr: { date: Date; count: number; level: 0 | 1 | 2 | 3 | 4 }[][] = [];
    let currentWeek: { date: Date; count: number; level: 0 | 1 | 2 | 3 | 4 }[] = [];
    let currentMonth = -1;
    const monthLabelArr: { label: string; weekIndex: number }[] = [];

    let weekIndex = 0;
    const current = new Date(startDate);

    while (current <= today) {
      const dateStr = formatLocalDateKey(current);
      const count = data.get(dateStr) || 0;
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (count >= 5) level = 4;
      else if (count >= 3) level = 3;
      else if (count >= 2) level = 2;
      else if (count >= 1) level = 1;

      // Track month labels
      if (current.getMonth() !== currentMonth) {
        currentMonth = current.getMonth();
        monthLabelArr.push({ label: MONTHS[currentMonth], weekIndex });
      }

      currentWeek.push({ date: new Date(current), count, level });

      current.setDate(current.getDate() + 1);

      if (currentWeek.length === 7) {
        weeksArr.push(currentWeek);
        currentWeek = [];
        weekIndex++;
      }
    }

    if (currentWeek.length > 0) {
      weeksArr.push(currentWeek);
    }

    return {
      weeks: weeksArr,
      monthLabels: monthLabelArr,
      gridWidth: weeksArr.length * 14,
    };
  }, [data]);

  const getColor = (level: 0 | 1 | 2 | 3 | 4) => {
    switch (level) {
      case 0: return COLORS.level0;
      case 1: return COLORS.level1;
      case 2: return COLORS.level2;
      case 3: return COLORS.level3;
      case 4: return COLORS.level4;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.chartRow}>
        <View>
          <View style={styles.dayLabelsPlaceholder} />
          <View style={styles.dayLabels}>
            {DAYS.map((day, i) => (
              <Text key={i} style={styles.dayLabel}>{day}</Text>
            ))}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={[styles.monthLabels, { width: gridWidth }]}>
              {monthLabels.map((m, i) => (
                <Text key={i} style={[styles.monthLabel, { left: m.weekIndex * 14 }]}>
                  {m.label}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {weeks.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.week}>
                  {week.map((day, dayIndex) => (
                    <TouchableOpacity
                      key={`${weekIndex}-${dayIndex}`}
                      style={[styles.cell, { backgroundColor: getColor(day.level) }]}
                      onPress={() => day.count > 0 && onDayPress?.(formatLocalDateKey(day.date), day.count)}
                      activeOpacity={0.7}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendLabel}>少</Text>
        {[0, 1, 2, 3, 4].map((level) => (
          <View
            key={level}
            style={[styles.legendCell, { backgroundColor: getColor(level as 0 | 1 | 2 | 3 | 4) }]}
          />
        ))}
        <Text style={styles.legendLabel}>多</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fdfcfb',
    borderRadius: 12,
    padding: 16,
  },
  chartRow: {
    flexDirection: 'row',
  },
  dayLabelsPlaceholder: {
    width: 20,
    height: 16,
    marginBottom: 4,
  },
  monthLabels: {
    height: 16,
    position: 'relative',
    marginBottom: 4,
  },
  monthLabel: {
    position: 'absolute',
    fontSize: 10,
    color: '#827066',
  },
  dayLabels: {
    width: 20,
    justifyContent: 'space-between',
  },
  dayLabel: {
    fontSize: 9,
    color: '#827066',
    height: 12,
    lineHeight: 12,
  },
  grid: {
    flexDirection: 'row',
  },
  week: {
    flexDirection: 'column',
  },
  cell: {
    width: 12,
    height: 12,
    borderRadius: 2,
    margin: 1,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 4,
  },
  legendLabel: {
    fontSize: 10,
    color: '#827066',
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
