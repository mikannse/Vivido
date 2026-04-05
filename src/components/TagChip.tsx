import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Tag } from '../types';

interface TagChipProps {
  tag: Tag;
  selected?: boolean;
  removable?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
}

export const TagChip: React.FC<TagChipProps> = ({
  tag,
  selected = false,
  removable = false,
  onPress,
  onRemove,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        selected && styles.chipSelected,
        { borderColor: tag.color },
        selected && { backgroundColor: tag.color },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.text,
          selected && styles.textSelected,
        ]}
      >
        {tag.name}
      </Text>
      {removable && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.removeIcon}>×</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#fdfcfb',
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: '#c47030',
    borderColor: '#c47030',
  },
  text: {
    fontSize: 13,
    color: '#3d2c1e',
  },
  textSelected: {
    color: '#fff',
  },
  removeButton: {
    marginLeft: 4,
  },
  removeIcon: {
    fontSize: 16,
    color: '#827066',
    fontWeight: '600',
  },
});