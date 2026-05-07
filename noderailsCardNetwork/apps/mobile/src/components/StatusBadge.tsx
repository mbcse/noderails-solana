import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tokens } from '../theme/tokens';

type CardStatus = 'ACTIVE' | 'FROZEN' | 'PENDING';
interface StatusBadgeProps { status: CardStatus; }

export function StatusBadge({ status }: StatusBadgeProps) {
  const bg = status === 'ACTIVE' ? tokens.colors['success-bg'] : status === 'FROZEN' ? tokens.colors['danger-bg'] : tokens.colors['warning-bg'];
  const fg = status === 'ACTIVE' ? tokens.colors.success : status === 'FROZEN' ? tokens.colors.danger : tokens.colors.warning;
  return (
    <View style={[styles.base, { backgroundColor: bg, borderColor: fg }]}>
      <Text style={[styles.label, { color: fg }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: tokens.radius.full, borderWidth: 1 },
  label: { fontSize: tokens.fontSize.xs, fontWeight: '700', letterSpacing: 0.8 },
});
