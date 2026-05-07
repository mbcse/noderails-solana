import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { tokens } from '../theme/tokens';

interface ListRowProps extends Omit<PressableProps, 'style'> {
  title: string;
  subtitle?: string;
  icon?: LucideIcon | React.ComponentType<any>;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ListRow({
  title,
  subtitle,
  icon: Icon,
  rightElement,
  showChevron = false,
  style,
  ...rest
}: ListRowProps) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        style,
      ]}
    >
      {Icon && (
        <View style={styles.iconContainer}>
          <Icon size={20} color={tokens.colors.accent} strokeWidth={1.5} />
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {rightElement && <View style={styles.rightElement}>{rightElement}</View>}

      {showChevron && (
        <ChevronRight
          size={20}
          color={tokens.colors['muted-foreground']}
          strokeWidth={1.5}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.card,
    borderRadius: tokens.radius.md,
    gap: tokens.spacing.md,
    ...tokens.shadows.soft,
  },

  rowPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },

  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    flex: 1,
  },

  title: {
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
    marginBottom: 2,
  },

  subtitle: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.sm,
    fontWeight: '400',
  },

  rightElement: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
