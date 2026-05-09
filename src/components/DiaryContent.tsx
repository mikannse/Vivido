import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  content: string;
}

const TEXT_PRIMARY = '#3d2c1e';
const TEXT_MUTED = '#7a6250';

const SHORT_PARAGRAPH_THRESHOLD = 25;

const splitIntoParagraphs = (text: string): string[] => {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
};

const isShortParagraph = (text: string): boolean => {
  if (text.length <= SHORT_PARAGRAPH_THRESHOLD) return true;
  if (text.length <= 40 && !text.includes('，') && !text.includes('。')) return true;
  return false;
};

export const DiaryContent: React.FC<Props> = ({ content }) => {
  if (!content.trim()) return null;

  const paragraphs = splitIntoParagraphs(content);

  return (
    <View style={styles.container}>
      {paragraphs.map((para, index) => {
        const isShort = isShortParagraph(para);
        return (
          <Text
            key={index}
            style={[
              styles.paragraph,
              isShort && styles.shortParagraph,
            ]}
          >
            {isShort ? para : '\u3000\u3000' + para.replace(/\n/g, '\n\u3000\u3000')}
          </Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  paragraph: {
    fontSize: 17,
    color: TEXT_PRIMARY,
    lineHeight: 34,
    fontFamily: 'LXGWWenKaiLite',
    letterSpacing: 0.3,
    marginBottom: 16,
    textAlign: 'justify',
  },
  shortParagraph: {
    textAlign: 'center',
    color: TEXT_MUTED,
    fontSize: 16,
    lineHeight: 32,
    marginBottom: 20,
    marginTop: 4,
  },
});
