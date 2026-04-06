import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface WordFrequency {
  word: string;
  count: number;
  level: 1 | 2 | 3;
}

interface WordCloudProps {
  data: WordFrequency[];
  onWordPress?: (word: string) => void;
}

export const WordCloud: React.FC<WordCloudProps> = ({ data, onWordPress }) => {
  if (data.length === 0) {
    return null;
  }

  const getFontSize = (level: 1 | 2 | 3): number => {
    switch (level) {
      case 1: return 14;
      case 2: return 18;
      case 3: return 24;
    }
  };

  const getColor = (level: 1 | 2 | 3): string => {
    switch (level) {
      case 1: return '#a89080';
      case 2: return '#c47030';
      case 3: return '#3d2c1e';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.cloud}>
        {data.map((item, index) => (
          <TouchableOpacity
            key={`${item.word}-${index}`}
            onPress={() => onWordPress?.(item.word)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.word,
                {
                  fontSize: getFontSize(item.level),
                  color: getColor(item.level),
                },
              ]}
            >
              {item.word}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fdfcfb',
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
  },
  cloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  word: {
    fontFamily: 'LXGWWenKaiLite',
    marginHorizontal: 4,
  },
});