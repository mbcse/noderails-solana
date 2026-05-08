import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Copy, Eye, EyeOff, PenLine, Send, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as SecureStore from '../utils/secureStore';
import { tokens } from '../theme/tokens';
import { CardVisual } from '../components/CardVisual';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { ListRow } from '../components/ListRow';
import { ActionButton } from '../components/ActionButton';
import { getApiBaseUrl } from '../config/apiBaseUrl';
import { loadCachedPrimaryCard, saveCachedPrimaryCard, mergePreservingFullPan, type CachedCard } from '../utils/cardCache';
import { formatPanDigitsForDisplay } from '../utils/panFormat';
import { copyToClipboard } from '../utils/copyToClipboard';
import { resolveCardholderEmbossLine } from '../utils/cardholder';
import {
  defaultWeb3CardPrefs,
  loadWeb3CardPrefs,
  saveWeb3CardPrefs,
  type Web3CardPrefs
} from '../utils/web3CardPrefs';
import type { MainTabsParamList } from '../navigation/MainTabs';
import type { RootStackParamList } from '../navigation/RootNavigator';

type CardNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, 'Card'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type CardData = CachedCard;

export function CardScreen() {
  const navigation = useNavigation<CardNav>();
  const [card, setCard] = useState<CardData | null>(null);
  const [cardholderLine, setCardholderLine] = useState('CARDHOLDER');
  const [isFlipped, setIsFlipped] = useState(false);
  const [showNumber, setShowNumber] = useState(false);
  const [web3Prefs, setWeb3Prefs] = useState<Web3CardPrefs>(() => defaultWeb3CardPrefs());

  const load = useCallback(async () => {
    let cached: CardData | null = null;
    cached = await loadCachedPrimaryCard();
    if (cached) setCard(cached);
    const apiUrl = getApiBaseUrl();
    try {
      const emboss = await resolveCardholderEmbossLine(apiUrl);
      setCardholderLine(emboss);
    } catch {
      setCardholderLine('CARDHOLDER');
    }
    try {
      const token = await SecureStore.getItemAsync('wallcard_auth_token');
      if (!token) return;
      const res = await fetch(`${apiUrl}/v1/wallet/cards`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const body = await res.json();
        if (body.data?.length) {
          const next = body.data[0] as CardData;
          setCard((prev) => {
            const merged = mergePreservingFullPan(next, prev ?? cached ?? null);
            void saveCachedPrimaryCard(merged);
            return merged;
          });
        }
      } else if (__DEV__) {
        console.warn('[WallCard] CardScreen cards failed', res.status);
      }
    } catch (e) {
      if (__DEV__) console.warn('[WallCard] CardScreen load', e);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const emboss = await resolveCardholderEmbossLine(getApiBaseUrl());
          setCardholderLine(emboss);
        } catch {
          /* keep previous */
        }
      })();
    }, [])
  );

  useEffect(() => {
    void loadWeb3CardPrefs().then(setWeb3Prefs);
  }, []);

  const persistWeb3Prefs = useCallback(async (next: Web3CardPrefs) => {
    setWeb3Prefs(next);
    await saveWeb3CardPrefs(next);
  }, []);

  const copyCardNumber = useCallback(async () => {
    if (!card?.fullPanDigits) {
      Alert.alert(
        'Card number unavailable',
        'Tap the eye icon to reveal your number first, or refresh after signing in.'
      );
      return;
    }
    const digitsOnly = card.fullPanDigits.replace(/\D/g, '');
    if (digitsOnly.length < 13) {
      Alert.alert('Card number unavailable', 'Full card number is not loaded yet.');
      return;
    }
    try {
      const ok = await copyToClipboard(digitsOnly);
      if (!ok) {
        Alert.alert('Copy failed', 'Could not copy to clipboard. Try again.');
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Copied', 'Card number copied to clipboard.');
    } catch (e) {
      if (__DEV__) console.warn('[WallCard] copy PAN', e);
      Alert.alert('Copy failed', 'Could not copy to clipboard. Try again.');
    }
  }, [card?.fullPanDigits]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>My WallCard</Text>
        <Pressable
          onPress={() => setShowNumber(!showNumber)}
          style={styles.eyeButton}
          accessibilityRole="button"
          accessibilityLabel={showNumber ? 'Hide card number and CVV' : 'Show card number and CVV'}
        >
          {showNumber ? (
            <Eye size={20} color={tokens.colors.foreground} strokeWidth={1.5} />
          ) : (
            <EyeOff size={20} color={tokens.colors.foreground} strokeWidth={1.5} />
          )}
        </Pressable>
      </View>

      <Text style={styles.numberHint}>
        {!showNumber
          ? 'Tap the eye to show card number and CVV (flip card for CVV).'
          : card?.fullPanDigits
            ? 'Sensitive details. Same encryption key as your stored card number (AES-GCM at rest).'
            : 'Card number unavailable. Pull to refresh or sign in again.'}
      </Text>

      {/* Card visual - fillable area */}
      <View style={styles.cardWrap}>
        {card ? (
          <CardVisual
            maskedNumber={
              showNumber
                ? card.fullPanDigits
                  ? formatPanDigitsForDisplay(card.fullPanDigits)
                  : card.maskedNumber
                : undefined
            }
            panLastFour={card.panLastFour}
            expiryMonth={card.expiryMonth}
            expiryYear={card.expiryYear}
            brand={card.brand}
            cardholderName={cardholderLine}
            status={card.status}
            isFlipped={isFlipped}
            expandPan={showNumber}
            cvvDigits={card.cvvDigits}
            revealSensitive={showNumber}
            onFlip={() => setIsFlipped(!isFlipped)}
          />
        ) : (
          <View style={styles.cardPlaceholder}>
            <Text style={styles.placeholderText}>No card issued yet</Text>
          </View>
        )}
      </View>

      <Text style={styles.tapHint}>Tap card to flip</Text>

      {/* Card controls section */}
      {card && !isFlipped && (
        <View>
          <Text style={styles.sectionTitle}>Quick controls</Text>

          <ListRow
            icon={Copy}
            title="Copy card number"
            subtitle={
              card.fullPanDigits
                ? 'Copies digits only. Paste at checkout.'
                : 'Reveal number first (tap eye icon)'
            }
            onPress={() => void copyCardNumber()}
          />

          <ListRow
            icon={PenLine}
            title="Allow signing"
            subtitle="Approve messages and requests without sending crypto."
            rightElement={
              <ToggleSwitch
                value={web3Prefs.signingEnabled}
                onValueChange={(v) => void persistWeb3Prefs({ ...web3Prefs, signingEnabled: v })}
              />
            }
            onPress={() => void persistWeb3Prefs({ ...web3Prefs, signingEnabled: !web3Prefs.signingEnabled })}
            style={styles.rowGap}
          />

          <ListRow
            icon={Send}
            title="Allow payments"
            subtitle="Let confirmed actions send crypto when you approve."
            rightElement={
              <ToggleSwitch
                value={web3Prefs.transactionsEnabled}
                onValueChange={(v) => void persistWeb3Prefs({ ...web3Prefs, transactionsEnabled: v })}
              />
            }
            onPress={() =>
              void persistWeb3Prefs({ ...web3Prefs, transactionsEnabled: !web3Prefs.transactionsEnabled })
            }
            style={styles.rowGap}
          />

          {/* Security section */}
          <Text style={[styles.sectionTitle, styles.securityTitle]}>Security</Text>

          <ListRow
            icon={Lock}
            title="Card PIN"
            subtitle="Set during signup. Contact support to rotate."
            showChevron
            onPress={() =>
              Alert.alert(
                'Card PIN',
                'Your 6-digit wallet PIN was set when you created your WallCard. To change it later we’ll add PIN rotation in a future update.',
                [{ text: 'OK' }]
              )
            }
          />
        </View>
      )}

      {/* Primary action */}
      <ActionButton
        label="Limits & payment types"
        variant="primary"
        onPress={() => navigation.navigate('CardSettings')}
        style={styles.primaryAction}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },

  content: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: 60,
    paddingBottom: 40,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.lg,
  },

  pageTitle: {
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.lg,
    fontWeight: '600',
  },

  eyeButton: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.colors.secondary,
  },

  numberHint: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.xs,
    lineHeight: 17,
    marginBottom: tokens.spacing.md,
    marginTop: -4,
  },

  cardWrap: {
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },

  cardPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.soft,
  },

  placeholderText: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.sm,
  },

  tapHint: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.sm,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: tokens.spacing.lg,
  },

  sectionTitle: {
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
    marginBottom: tokens.spacing.md,
  },

  securityTitle: {
    marginTop: tokens.spacing.lg,
  },

  rowGap: {
    marginTop: tokens.spacing.md,
  },

  primaryAction: {
    marginTop: tokens.spacing.lg,
  },
});
