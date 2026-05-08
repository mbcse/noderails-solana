import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Plus, Send, ArrowDownLeft, Settings2 } from 'lucide-react-native';
import * as SecureStore from '../utils/secureStore';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from '../theme/tokens';
import { CardVisual } from '../components/CardVisual';
import { BalanceRow } from '../components/BalanceRow';
import { ActivityRow } from '../components/ActivityRow';
import { getApiBaseUrl } from '../config/apiBaseUrl';
import { loadCachedPrimaryCard, saveCachedPrimaryCard, mergePreservingFullPan, type CachedCard } from '../utils/cardCache';
import { resolveCardholderEmbossLine } from '../utils/cardholder';
import type { WalletActivityRow } from '../utils/activityLabels';
import type { MainTabsParamList } from '../navigation/MainTabs';
import type { RootStackParamList } from '../navigation/RootNavigator';

type HomeNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type CardData = CachedCard;

type BalanceData = {
  chain: string;
  chainName: string;
  symbol: string;
  balance: string;
  source: string;
};

function cardPlaceholderMessage(walletLoaded: boolean, loadHint: string | null, apiReturnedNoCards: boolean): string {
  if (!walletLoaded) return 'Loading card…';
  if (loadHint?.includes('Sign in')) return 'Sign in to see your card';
  if (apiReturnedNoCards) return 'Could not load card details. Pull down to refresh.';
  if (loadHint) return 'Card unavailable. Pull down to refresh.';
  return 'Complete setup to see your card';
}

const WALLET_FETCH_MS = 25_000;

function fetchWithTimeout(url: string, init: RequestInit | undefined, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

function isAbortError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === 'AbortError' || /aborted/i.test(e.message);
}

function notifyComingSoon(title: string) {
  void Haptics.selectionAsync();
  Alert.alert(title, 'This action will be available in a future update.', [{ text: 'OK' }]);
}

export function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const [card, setCard] = useState<CardData | null>(null);
  const [balances, setBalances] = useState<BalanceData[]>([]);
  const [activity, setActivity] = useState<WalletActivityRow[]>([]);
  const [cardholderLine, setCardholderLine] = useState('CARDHOLDER');
  const [refreshing, setRefreshing] = useState(false);
  const [totalBalance, setTotalBalance] = useState('$0.00');
  const [loadHint, setLoadHint] = useState<string | null>(null);
  const [walletLoaded, setWalletLoaded] = useState(false);
  const [apiReturnedNoCards, setApiReturnedNoCards] = useState(false);

  const load = useCallback(async () => {
    const apiUrl = getApiBaseUrl();
    setLoadHint(null);
    setApiReturnedNoCards(false);

    let cached: CardData | null = null;

    try {
      cached = await loadCachedPrimaryCard();
      if (cached) setCard(cached);

      const token = await SecureStore.getItemAsync('wallcard_auth_token');
      if (!token) {
        setLoadHint('Sign in again to load your card.');
        setActivity([]);
        try {
          const emboss = await resolveCardholderEmbossLine(apiUrl);
          setCardholderLine(emboss);
        } catch {
          setCardholderLine('CARDHOLDER');
        }
        return;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      };

      const [balRes, cardRes, actRes] = await Promise.all([
        fetchWithTimeout(`${apiUrl}/v1/wallet/balances`, { headers }, WALLET_FETCH_MS),
        fetchWithTimeout(`${apiUrl}/v1/wallet/cards`, { headers }, WALLET_FETCH_MS),
        fetchWithTimeout(`${apiUrl}/v1/wallet/activity?limit=25`, { headers }, WALLET_FETCH_MS),
      ]);

      const embossLine = await resolveCardholderEmbossLine(apiUrl).catch(() => 'CARDHOLDER');
      setCardholderLine(embossLine);

      if (actRes.ok) {
        const raw = await actRes.json().catch(() => ({}));
        const rows = Array.isArray(raw.data) ? raw.data : [];
        setActivity(rows as WalletActivityRow[]);
      } else {
        setActivity([]);
        if (__DEV__) console.warn('[WallCard] activity failed', actRes.status);
      }

      if (balRes.ok) {
        const b = await balRes.json();
        setBalances(b.data ?? []);
        const total = (b.data ?? []).reduce((sum: number, bal: BalanceData) => {
          const num = parseFloat(String(bal.balance).replace(/[^0-9.-]/g, ''));
          return sum + (isNaN(num) ? 0 : num);
        }, 0);
        setTotalBalance(`$${total.toFixed(2)}`);
      } else if (__DEV__) {
        console.warn('[WallCard] balances failed', balRes.status, await balRes.text());
      }

      if (cardRes.ok) {
        const c = await cardRes.json();
        const list = Array.isArray(c?.data) ? c.data : [];
        if (list.length > 0) {
          const next = list[0] as CardData;
          setCard((prev) => {
            const merged = mergePreservingFullPan(next, prev ?? cached ?? null);
            void saveCachedPrimaryCard(merged);
            return merged;
          });
        } else {
          setApiReturnedNoCards(true);
        }
      } else {
        const detail = await cardRes.text().catch(() => '');
        if (__DEV__) console.warn('[WallCard] cards failed', cardRes.status, detail);
        if (!cached) {
          setLoadHint(
            cardRes.status === 401
              ? 'Session expired. Sign out and sign in again.'
              : `Could not reach API (${cardRes.status}). Check EXPO_PUBLIC_API_URL / VPN. Using ${apiUrl}`
          );
        } else {
          setLoadHint(`Showing saved card. Refresh failed (${cardRes.status}). API: ${apiUrl}`);
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[WallCard] wallet load error', e);
      const cachedNow = await loadCachedPrimaryCard();
      if (isAbortError(e)) {
        if (!cachedNow) {
          setLoadHint(`Request timed out. Is the API reachable? (${apiUrl})`);
        } else {
          setLoadHint(`Showing saved card. Request timed out. API: ${apiUrl}`);
        }
      } else if (!cachedNow) {
        setLoadHint(`Network error. Is the API running? (${apiUrl})`);
      } else {
        setLoadHint(`Showing saved card. Offline or unreachable (${apiUrl})`);
      }
    } finally {
      setWalletLoaded(true);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={tokens.colors.accent}
        />
      }
    >
      {/* Header with greeting and total balance */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>TOTAL BALANCE</Text>
          <Text style={styles.totalBalance}>{totalBalance}</Text>
          <Text style={styles.change}>+2.4% today</Text>
          {loadHint ? <Text style={styles.loadHint}>{loadHint}</Text> : null}
        </View>
      </View>

      {/* WallCard visual */}
      <View style={styles.cardWrap}>
        {card ? (
          <CardVisual
            maskedNumber={card.maskedNumber}
            panLastFour={card.panLastFour}
            expiryMonth={card.expiryMonth}
            expiryYear={card.expiryYear}
            brand={card.brand}
            cardholderName={cardholderLine}
            status={card.status}
          />
        ) : (
          <View style={styles.cardPlaceholder}>
            <Text style={styles.cardPlaceholderText}>
              {cardPlaceholderMessage(walletLoaded, loadHint, apiReturnedNoCards)}
            </Text>
          </View>
        )}
      </View>

      {/* Quick action pills */}
      <View style={styles.quickActions}>
        <Pressable
          style={styles.quickActionBtn}
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
          onPress={() => notifyComingSoon('Top up')}
        >
          <LinearGradient
            colors={['#0D0221', '#4C1D95', '#FF2E93', '#FF6B35']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quickActionGradient}
          >
            <Plus size={24} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.quickActionLabel}>Top up</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={styles.quickActionBtn}
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
          onPress={() => notifyComingSoon('Send')}
        >
          <LinearGradient
            colors={['#0D0221', '#4C1D95', '#FF2E93', '#FF6B35']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quickActionGradient}
          >
            <Send size={24} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.quickActionLabel}>Send</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={styles.quickActionBtn}
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
          onPress={() => notifyComingSoon('Request')}
        >
          <LinearGradient
            colors={['#0D0221', '#4C1D95', '#FF2E93', '#FF6B35']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quickActionGradient}
          >
            <ArrowDownLeft size={24} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.quickActionLabel}>Request</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={styles.quickActionBtn}
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
          onPress={() => navigation.navigate('CardSettings')}
        >
          <LinearGradient
            colors={['#0D0221', '#4C1D95', '#FF2E93', '#FF6B35']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quickActionGradient}
          >
            <Settings2 size={24} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.quickActionLabel}>Limits</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Balances: portfolio snapshot */}
      <View style={styles.feedSection}>
        <View style={styles.activityHeader}>
          <Text style={styles.activityTitle}>Balances</Text>
        </View>
        <Text style={styles.sectionHint}>Balances on each network. Not the same thing as your signature history below.</Text>

        {balances.length > 0 ? (
          balances.map((b) => (
            <View key={b.chain} style={styles.feedRowGap}>
              <BalanceRow chainName={b.chainName} symbol={b.symbol} balance={b.balance} />
            </View>
          ))
        ) : (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>No balances loaded yet</Text>
          </View>
        )}
      </View>

      {/* Recent activity: WallCard signing requests */}
      <View style={[styles.feedSection, styles.sectionSpacingTop]}>
        <View style={styles.activityHeader}>
          <Text style={styles.activityTitle}>Recent activity</Text>
          <Pressable onPress={() => notifyComingSoon('Full activity')} hitSlop={12}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        <Text style={styles.sectionHint}>Requests where something asked your WallCard to sign or pay.</Text>

        {activity.length > 0 ? (
          activity.slice(0, 15).map((row) => (
            <View key={row.id} style={styles.feedRowGap}>
              <ActivityRow row={row} />
            </View>
          ))
        ) : (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>Nothing here yet. Approve something from the Sign tab or a site that uses WallCard.</Text>
          </View>
        )}
      </View>
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

  header: {
    marginBottom: tokens.spacing.xl,
  },

  eyebrow: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.25 * tokens.fontSize.xs,
    textTransform: 'uppercase',
    marginBottom: tokens.spacing.xs,
  },

  totalBalance: {
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.hero,
    fontWeight: '700',
    letterSpacing: -0.02,
  },

  change: {
    color: tokens.colors.success,
    fontSize: tokens.fontSize.sm,
    fontWeight: '500',
    marginTop: tokens.spacing.xs,
  },

  loadHint: {
    color: tokens.colors.warning,
    fontSize: tokens.fontSize.xs,
    marginTop: tokens.spacing.sm,
    lineHeight: 18,
  },

  cardWrap: {
    alignItems: 'center',
    marginBottom: tokens.spacing.lg,
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

  cardPlaceholderText: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.sm,
  },

  quickActions: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.xl,
    justifyContent: 'space-between',
  },

  quickActionBtn: {
    flex: 1,
    height: 100,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    ...tokens.shadows.card,
  },

  quickActionGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
  },

  quickActionLabel: {
    color: '#FFFFFF',
    fontSize: tokens.fontSize.xs,
    fontWeight: '600',
    marginTop: tokens.spacing.xs,
  },

  feedSection: {
    gap: tokens.spacing.sm,
  },

  sectionSpacingTop: {
    marginTop: tokens.spacing.xl,
  },

  sectionHint: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.xs,
    lineHeight: 17,
    marginBottom: tokens.spacing.sm,
  },

  feedRowGap: {
    marginBottom: tokens.spacing.sm,
  },

  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },

  activityTitle: {
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.lg,
    fontWeight: '600',
  },

  seeAll: {
    color: tokens.colors.accent,
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
  },

  emptyRow: {
    backgroundColor: tokens.colors.card,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
  },

  emptyText: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.sm,
  },
});
