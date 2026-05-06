import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ActionButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export function ActionButton({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  icon,
  iconPosition = 'right',
  ...rest
}: ActionButtonProps) {
  const isDisabled = disabled || loading;

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          color={variant === 'primary' ? '#FFFFFF' : tokens.colors.accent}
          size="small"
        />
      );
    }

    return (
      <View style={styles.content}>
        {icon && iconPosition === 'left' && icon}
        <Text style={[styles.label, styles[`${variant}Label` as keyof typeof styles]]}>
          {label}
        </Text>
        {icon && iconPosition === 'right' && icon}
      </View>
    );
  };

  const buttonContent = (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled && styles[`${variant}Pressed` as keyof typeof styles],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={['#0D0221', '#4C1D95', '#FF2E93', '#FF6B35']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, styles.primaryGradient]}
        >
          {renderContent()}
        </LinearGradient>
      ) : (
        renderContent()
      )}
    </Pressable>
  );

  return buttonContent;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: tokens.radius.md,
    paddingVertical: 15,
    paddingHorizontal: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  // Primary - Aurora gradient
  primary: {
    ...tokens.shadows.card,
  },

  primaryGradient: {
    ...tokens.shadows.card,
  },

  primaryPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  primaryLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: tokens.fontSize.md,
  },

  // Secondary - Light surface
  secondary: {
    backgroundColor: tokens.colors.secondary,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },

  secondaryPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },

  secondaryLabel: {
    color: tokens.colors.foreground,
    fontWeight: '600',
    fontSize: tokens.fontSize.md,
  },

  // Ghost - No background
  ghost: {
    backgroundColor: 'transparent',
  },

  ghostPressed: {
    backgroundColor: tokens.colors.muted,
    transform: [{ scale: 0.98 }],
  },

  ghostLabel: {
    color: tokens.colors.accent,
    fontWeight: '600',
    fontSize: tokens.fontSize.md,
  },

  // Disabled state
  disabled: {
    opacity: 0.5,
  },

  label: {
    textAlign: 'center',
  },
});
