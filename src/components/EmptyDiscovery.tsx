import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface EmptyDiscoveryProps {
  type: 'search' | 'filter' | 'general';
}

const MESSAGES = {
  search: {
    title: '这里暂时还没有回忆',
    subtitle: '换个关键词试试吧',
  },
  filter: {
    title: '没有符合条件的日记',
    subtitle: '试试调整筛选条件',
  },
  general: {
    title: '还没有任何日记',
    subtitle: '去记录今天吧',
  },
};

export const EmptyDiscovery: React.FC<EmptyDiscoveryProps> = ({ type }) => {
  const message = MESSAGES[type];

  return (
    <View style={styles.container}>
      <View style={styles.illustration}>
        <Text style={styles.emoji}>📝</Text>
      </View>
      <Text style={styles.title}>{message.title}</Text>
      <Text style={styles.subtitle}>{message.subtitle}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  illustration: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0ebe5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3d2c1e',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#827066',
    textAlign: 'center',
  },
});