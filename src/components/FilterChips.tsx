import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { TimeFilter } from '../types';

interface FilterChipsProps {
  selected: TimeFilter;
  onSelect: (filter: TimeFilter) => void;
}

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '上个月' },
  { key: 'sameDayLastYear', label: '那年今日' },
];

export const FilterChips: React.FC<FilterChipsProps> = ({ selected, onSelect }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {TIME_FILTERS.map((filter) => (
        <TouchableOpacity
          key={filter.key}
          style={[
            styles.chip,
            selected === filter.key && styles.chipSelected,
          ]}
          onPress={() => onSelect(filter.key)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.chipText,
              selected === filter.key && styles.chipTextSelected,
            ]}
          >
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2ddd8',
    backgroundColor: '#fdfcfb',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#c47030',
    borderColor: '#c47030',
  },
  chipText: {
    fontSize: 14,
    color: '#3d2c1e',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
});