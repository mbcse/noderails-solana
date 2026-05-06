import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { tokens } from '../theme/tokens';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}

export function GlassCard({ children, style, intensity = 80 }: GlassCardProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint="light" />
      <View style={styles.border} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: tokens.radius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  content: {
    padding: tokens.spacing.md,
  },
});
