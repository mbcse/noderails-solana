import React, { useRef } from 'react';
import { View, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { tokens } from '../theme/tokens';

interface PinInputProps {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}

const BOX = 52;
const GAP = 10;

export function PinInput({ value, onChange, maxLength = 6 }: PinInputProps) {
  const ref = useRef<TextInput>(null);
  const focusPulse = useSharedValue(0);

  const handle = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, maxLength);
    if (digits.length > value.length) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (digits.length < value.length) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    onChange(digits);
    focusPulse.value = withSpring(1, { damping: 14, stiffness: 220 }, () => {
      focusPulse.value = withSpring(0, { damping: 16, stiffness: 180 });
    });
  };

  const rowAnim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + focusPulse.value * 0.012 }],
  }));

  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      style={styles.wrap}
      accessibilityLabel="Enter PIN, numeric keypad"
    >
      <TextInput
        ref={ref}
        value={value}
        onChangeText={handle}
        keyboardType="number-pad"
        maxLength={maxLength}
        secureTextEntry
        textContentType="password"
        autoComplete="off"
        importantForAutofill="no"
        caretHidden
        style={styles.hiddenCapture}
      />
      <Animated.View style={[styles.dots, rowAnim]}>
        {Array.from({ length: maxLength }).map((_, i) => {
          const filled = i < value.length;
          const active = i === value.length;
          return (
            <View
              key={i}
              style={[
                styles.box,
                filled && styles.boxFilled,
                active && styles.boxActive,
              ]}
            >
              {filled ? <View style={styles.bullet} /> : null}
            </View>
          );
        })}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm,
  },
  /** Keeps the keyboard reliable on Android while staying visually hidden */
  hiddenCapture: {
    ...(Platform.OS === 'android'
      ? {
          position: 'absolute',
          width: 1,
          height: 1,
          left: -40,
          top: 24,
          opacity: 0,
        }
      : {
          position: 'absolute',
          width: '100%',
          height: BOX,
          opacity: 0,
        }),
  },
  dots: {
    flexDirection: 'row',
    gap: GAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: BOX,
    height: BOX,
    borderRadius: tokens.radius.md,
    borderWidth: 2,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.soft,
  },
  boxFilled: {
    borderColor: `${tokens.colors.accent}99`,
    backgroundColor: tokens.colors.secondary,
  },
  boxActive: {
    borderColor: tokens.colors.accent,
    shadowColor: tokens.colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  bullet: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.colors.foreground,
  },
});
