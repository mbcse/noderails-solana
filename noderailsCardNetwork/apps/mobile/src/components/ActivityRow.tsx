import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PenLine } from 'lucide-react-native';
import { tokens } from '../theme/tokens';
import type { WalletActivityRow } from '../utils/activityLabels';
import {
  activityPrimaryTitle,
  activitySourceSubtitle,
  formatRelativeTime,
  statusLabel
} from '../utils/activityLabels';

interface ActivityRowProps {
  row: WalletActivityRow;
}

function statusStyle(status: string) {
  if (status === 'succeeded') return styles.statusOk;
  if (status === 'failed') return styles.statusFail;
  return styles.statusPending;
}

export function ActivityRow({ row }: ActivityRowProps) {
  const title = activityPrimaryTitle(row.chainFamily, row.method);
  const src = activitySourceSubtitle(row.requestSource, row.requestOrigin);
  const rel = formatRelativeTime(row.createdAt);
  const pillText = statusLabel(row.status);

  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <PenLine size={18} color={tokens.colors.accent} strokeWidth={2} />
      </View>
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {src}
        </Text>
        {row.status === 'failed' && row.error ? (
          <Text style={styles.err} numberOfLines={2}>
            {row.error.replace(/^signing_failure:/, '').slice(0, 120)}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={[styles.pill, statusStyle(row.status)]}>{pillText}</Text>
        <Text style={styles.time}>{rel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.md,
    backgroundColor: tokens.colors.card,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    ...tokens.shadows.soft
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  mid: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.md,
    fontWeight: '600'
  },
  sub: {
    marginTop: 4,
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.xs,
    lineHeight: 16
  },
  err: {
    marginTop: 6,
    color: tokens.colors.danger,
    fontSize: tokens.fontSize.xs,
    lineHeight: 15
  },
  right: {
    alignItems: 'flex-end',
    gap: 6
  },
  pill: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radius.full,
    overflow: 'hidden'
  },
  statusOk: {
    color: tokens.colors.success,
    backgroundColor: `${tokens.colors.success}18`
  },
  statusFail: {
    color: tokens.colors.danger,
    backgroundColor: `${tokens.colors.danger}18`
  },
  statusPending: {
    color: tokens.colors.warning,
    backgroundColor: `${tokens.colors.warning}22`
  },
  time: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.xs,
    fontWeight: '500'
  }
});
