import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BRAND_GOLD = '#c47030';

// Vivido watermark - subtle branding for detail views
export const VividoWatermark = () => (
  <View style={styles.watermark}>
    <Text style={styles.watermarkText}>Vivido</Text>
  </View>
);

// Brand glow effect wrapper
export const BrandGlow = ({
  children,
  intensity = 0.15,
}: {
  children: React.ReactNode;
  intensity?: number;
}) => (
  <View
    style={[
      styles.glowContainer,
      { shadowOpacity: intensity },
    ]}
  >
    {children}
  </View>
);

// Gold accent badge
export const GoldBadge = ({ text }: { text: string }) => (
  <View style={styles.badge}>
    <Text style={styles.badgeText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  watermark: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  watermarkText: {
    fontSize: 14,
    color: 'rgba(196, 112, 48, 0.35)',
    fontFamily: 'PlayfairDisplay',
    letterSpacing: 2,
  },
  glowContainer: {
    shadowColor: BRAND_GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 20,
    elevation: 4,
  },
  badge: {
    backgroundColor: 'rgba(196, 112, 48, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    color: BRAND_GOLD,
    fontWeight: '600',
  },
});
