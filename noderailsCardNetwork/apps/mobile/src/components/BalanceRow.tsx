import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import { tokens } from '../theme/tokens';

interface BalanceRowProps {
  chainName: string;
  symbol: string;
  balance: string | number;
  timestamp?: string;
  isIncome?: boolean;
}

function fmt(b: string | number): string {
  const n = typeof b === 'string' ? parseFloat(b) : b;
  if (isNaN(n)) return '0';
  const s = n.toFixed(6);
  return s.replace(/\.?0+$/, '') || '0';
}

export function BalanceRow({
  chainName,
  symbol,
  balance,
  timestamp,
  isIncome = false,
}: BalanceRowProps) {
  const isNegative = typeof balance === 'string' && balance.startsWith('-');
  const balanceStr = fmt(balance);

  return (
    <View style={styles.row}>
      <View style={styles.iconContainer}>
        <View
          style={[
            styles.iconBg,
            isIncome && styles.iconBgIncome,
          ]}
        >
          <ArrowUpRight
            size={18}
            color={isIncome ? tokens.colors.success : tokens.colors.accent}
            strokeWidth={2}
            style={!isIncome ? { transform: [{ rotate: '45deg' }] } : undefined}
          />
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{chainName}</Text>
        {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
      </View>

      <Text
        style={[
          styles.balance,
          isNegative ? styles.balanceNegative : styles.balancePositive,
        ]}
      >
        {isIncome ? '+' : ''}{balanceStr} {symbol}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.card,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginBottom: tokens.spacing.md,
    gap: tokens.spacing.md,
    ...tokens.shadows.soft,
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconBg: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: 'rgba(255, 46, 147, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconBgIncome: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
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

  timestamp: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.xs,
    fontWeight: '400',
  },

  balance: {
    fontSize: tokens.fontSize.md,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.18 * tokens.fontSize.md,
  },

  balanceNegative: {
    color: tokens.colors.danger,
  },

  balancePositive: {
    color: tokens.colors.success,
  },
});
