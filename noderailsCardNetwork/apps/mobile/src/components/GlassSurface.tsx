import React from 'react';
import {
  StyleSheet,
  View,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { tokens } from '../theme/tokens';

interface GlassSurfaceProps extends ViewProps {
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}

export function GlassSurface({
  intensity = 80,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  return (
    <View {...rest} style={[styles.container, style]}>
      <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint="light" />
      <View style={styles.border} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    overflow: 'hidden',
  },

  border: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
});
