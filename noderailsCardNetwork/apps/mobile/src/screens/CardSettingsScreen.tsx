import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { tokens } from '../theme/tokens';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { InputField } from '../components/InputField';
import { ActionButton } from '../components/ActionButton';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  ALL_WEB3_METHODS,
  defaultWeb3CardPrefs,
  isTransactionMethod,
  loadWeb3CardPrefs,
  saveWeb3CardPrefs,
  type Web3CardPrefs
} from '../utils/web3CardPrefs';
import { shortMethodLabel } from '../utils/activityLabels';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CardSettings'>;

export function CardSettingsScreen() {
  const nav = useNavigation<Nav>();
  const [prefs, setPrefs] = useState<Web3CardPrefs>(() => defaultWeb3CardPrefs());
  const [loaded, setLoaded] = useState(false);
  const [dailyStr, setDailyStr] = useState('');
  const [atmStr, setAtmStr] = useState('');

  useEffect(() => {
    void (async () => {
      const p = await loadWeb3CardPrefs();
      setPrefs(p);
      setDailyStr(String(p.dailyTxnLimitUsd));
      setAtmStr(String(p.atmDailyLimitUsd));
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback(async (next: Web3CardPrefs) => {
    setPrefs(next);
    await saveWeb3CardPrefs(next);
    setDailyStr(String(next.dailyTxnLimitUsd));
    setAtmStr(String(next.atmDailyLimitUsd));
  }, []);

  const signingMethods = ALL_WEB3_METHODS.filter((m) => !isTransactionMethod(m));
  const txMethods = ALL_WEB3_METHODS.filter((m) => isTransactionMethod(m));

  const parseUsd = (raw: string, fallback: number): number => {
    const n = Number.parseFloat(raw.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.lead}>
        Decide how apps use your WallCard to confirm it&apos;s you and to move funds. These choices apply in the app
        today; stricter checks from our servers will layer on over time.
      </Text>

      <Text style={styles.section}>Safety switches</Text>
      <View style={styles.card}>
        <RowToggle
          title="Allow signing"
          subtitle="Apps can ask you to approve messages and structured requests. Nothing leaves your wallet unless you confirm."
          value={prefs.signingEnabled}
          onChange={(v) => void persist({ ...prefs, signingEnabled: v })}
          disabled={!loaded}
        />
        <View style={styles.divider} />
        <RowToggle
          title="Allow payments & transfers"
          subtitle="Apps can prepare sends, swaps, and similar actions that actually move crypto."
          value={prefs.transactionsEnabled}
          onChange={(v) => void persist({ ...prefs, transactionsEnabled: v })}
          disabled={!loaded}
        />
      </View>

      <Text style={styles.section}>Daily limits (USD)</Text>
      <Text style={styles.sectionFootnote}>Rough ceilings you want to stay within. We&apos;ll use them for prompts and guardrails as we ship smarter protections.</Text>
      <View style={styles.card}>
        <InputField
          label="Overall daily ceiling"
          keyboardType="decimal-pad"
          value={dailyStr}
          onChangeText={setDailyStr}
          onEndEditing={() => {
            const v = parseUsd(dailyStr, prefs.dailyTxnLimitUsd);
            void persist({ ...prefs, dailyTxnLimitUsd: v });
          }}
          helperText="Typical cap for how much activity feels comfortable in one day."
          editable={loaded}
        />
        <View style={{ height: tokens.spacing.md }} />
        <InputField
          label="Large-move threshold"
          keyboardType="decimal-pad"
          value={atmStr}
          onChangeText={setAtmStr}
          onEndEditing={() => {
            const v = parseUsd(atmStr, prefs.atmDailyLimitUsd);
            void persist({ ...prefs, atmDailyLimitUsd: v });
          }}
          helperText="Above this amount, we&apos;ll treat moves as extra sensitive once alerts ship."
          editable={loaded}
        />
      </View>

      <Text style={styles.section}>Confirmation types</Text>
      <View style={styles.card}>
        {signingMethods.map((method, i) => (
          <View key={method}>
            {i > 0 ? <View style={styles.divider} /> : null}
            <RowToggle
              title={shortMethodLabel(method)}
              subtitle="Does not move funds by itself."
              value={prefs.methodEnabled[method] !== false}
              onChange={(v) =>
                void persist({
                  ...prefs,
                  methodEnabled: { ...prefs.methodEnabled, [method]: v }
                })
              }
              disabled={!loaded || !prefs.signingEnabled}
            />
          </View>
        ))}
      </View>

      <Text style={styles.section}>Payment types</Text>
      <View style={styles.card}>
        {txMethods.map((method, i) => (
          <View key={method}>
            {i > 0 ? <View style={styles.divider} /> : null}
            <RowToggle
              title={shortMethodLabel(method)}
              subtitle="Can send tokens or pay network fees."
              value={prefs.methodEnabled[method] !== false}
              onChange={(v) =>
                void persist({
                  ...prefs,
                  methodEnabled: { ...prefs.methodEnabled, [method]: v }
                })
              }
              disabled={!loaded || !prefs.transactionsEnabled}
            />
          </View>
        ))}
      </View>

      <ActionButton label="Done" variant="primary" onPress={() => nav.goBack()} style={styles.done} />
    </ScrollView>
  );
}

function RowToggle(props: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.rowToggle}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{props.title}</Text>
        <Text style={styles.rowSub}>{props.subtitle}</Text>
      </View>
      <ToggleSwitch value={props.value} onValueChange={props.onChange} disabled={props.disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.background
  },
  content: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: 48,
    paddingTop: tokens.spacing.sm
  },
  lead: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.sm,
    lineHeight: 20,
    marginBottom: tokens.spacing.lg
  },
  section: {
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.md,
    fontWeight: '700',
    marginBottom: tokens.spacing.sm,
    marginTop: tokens.spacing.md
  },

  sectionFootnote: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.xs,
    lineHeight: 17,
    marginBottom: tokens.spacing.sm,
    marginTop: -4
  },
  card: {
    backgroundColor: tokens.colors.card,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    ...tokens.shadows.soft
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.border,
    marginVertical: tokens.spacing.md
  },
  rowToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md
  },
  rowText: {
    flex: 1,
    minWidth: 0
  },
  rowTitle: {
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.md,
    fontWeight: '600'
  },
  rowSub: {
    marginTop: 4,
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.xs,
    lineHeight: 16
  },
  done: {
    marginTop: tokens.spacing.xl
  }
});
