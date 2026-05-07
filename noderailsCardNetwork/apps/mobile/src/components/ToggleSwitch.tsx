import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from '../theme/tokens';

interface ToggleSwitchProps extends Omit<PressableProps, 'onPress'> {
  value: boolean;
  onValueChange?: (value: boolean) => void;
}

const KNOB_SIZE = 24;
const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const PADDING = 2;

export function ToggleSwitch({ value, onValueChange, ...rest }: ToggleSwitchProps) {
  const translateX = useSharedValue(value ? TRACK_WIDTH - KNOB_SIZE - PADDING * 2 : PADDING);

  useEffect(() => {
    translateX.value = withSpring(
      value ? TRACK_WIDTH - KNOB_SIZE - PADDING * 2 : PADDING,
      { damping: 15, mass: 1 }
    );
  }, [value]);

  const knobAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Pressable
      {...rest}
      onPress={() => onValueChange?.(!value)}
    >
      {value ? (
        <LinearGradient
          colors={['#0D0221', '#4C1D95', '#FF2E93', '#FF6B35']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.track}
        >
          <View style={StyleSheet.absoluteFill} pointerEvents="none" />
        </LinearGradient>
      ) : (
        <View style={[styles.track, styles.trackOff]} />
      )}

      <Animated.View style={[styles.knob, knobAnim]}>
        <View style={styles.knobInner} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    padding: PADDING,
    justifyContent: 'center',
    ...tokens.shadows.soft,
  },

  trackOff: {
    backgroundColor: 'oklch(0.9 0.01 320)',
  },

  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    justifyContent: 'center',
    alignItems: 'center',
  },

  knobInner: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    ...tokens.shadows.soft,
  },
});
