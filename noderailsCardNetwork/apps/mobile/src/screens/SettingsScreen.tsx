import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Zap, Shield, Bell, HelpCircle, LogOut } from 'lucide-react-native';
import * as SecureStore from '../utils/secureStore';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { tokens } from '../theme/tokens';
import { ListRow } from '../components/ListRow';
import { ActionButton } from '../components/ActionButton';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getApiBaseUrl } from '../config/apiBaseUrl';
import { clearCachedPrimaryCard, loadCachedPrimaryCard } from '../utils/cardCache';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function readJwtEmail(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = globalThis.atob(b64 + pad);
    const data = JSON.parse(json) as { email?: string };
    return typeof data.email === 'string' && data.email.includes('@') ? data.email : null;
  } catch {
    return null;
  }
}

function truncMiddle(value: string, left = 8, right = 6): string {
  if (value.length <= left + right + 2) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

function toastSoon(title: string, body?: string) {
  void Haptics.selectionAsync();
  Alert.alert(title, body ?? 'We’ll ship this in a future release.', [{ text: 'OK' }]);
}

type Profile = {
  email?: string;
  displayName?: string;
  evmAddress?: string;
  solanaAddress?: string;
  initials?: string;
  panLastFour?: string;
};

export function SettingsScreen() {
  const nav = useNavigation<Nav>();
  const [profile, setProfile] = useState<Profile>({});

  useEffect(() => {
    void (async () => {
      try {
        const token = await SecureStore.getItemAsync('wallcard_auth_token');
        const emailStored = await SecureStore.getItemAsync('wallcard_user_email');
        const jwtEmail = token ? readJwtEmail(token) : null;
        const email = emailStored ?? jwtEmail ?? undefined;
        const baseName = email?.split('@')[0]?.replace(/[._]/g, ' ') ?? 'Member';

        const cachedCard = await loadCachedPrimaryCard();
        const panLastFour = cachedCard?.panLastFour;

        if (!token) {
          setProfile({
            email,
            displayName: baseName,
            initials: (email?.[0] ?? baseName[0] ?? 'W').toUpperCase(),
            panLastFour,
          });
          return;
        }

        const res = await fetch(`${getApiBaseUrl()}/v1/wallet/accounts`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });

        let evm: string | undefined;
        let sol: string | undefined;
        let displayNameFromApi: string | undefined;
        const profileRes = await fetch(`${getApiBaseUrl()}/v1/wallet/profile`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (profileRes.ok) {
          const pb = (await profileRes.json()) as { displayName?: string | null };
          displayNameFromApi = pb.displayName?.trim() || undefined;
        }

        if (res.ok) {
          const body = await res.json();
          const accounts = (body.data as { chainFamily: string; address: string }[]) ?? [];
          evm = accounts.find(a => a.chainFamily === 'evm')?.address;
          sol = accounts.find(a => a.chainFamily === 'solana')?.address;
        }

        const displayLabel = displayNameFromApi ?? baseName;

        setProfile({
          email,
          displayName: displayLabel,
          evmAddress: evm,
          solanaAddress: sol,
          initials: (displayLabel?.trim()?.[0] ?? email?.[0] ?? 'W').toUpperCase(),
          panLastFour,
        });
      } catch {
        /* silent */
      }
    })();
  }, []);

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('wallcard_auth_token');
    try {
      await SecureStore.deleteItemAsync('wallcard_user_email');
      await SecureStore.deleteItemAsync('wallcard_display_name');
    } catch {
      /* ignore */
    }
    await clearCachedPrimaryCard();
    nav.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <LinearGradient
          colors={['#0D0221', '#4C1D95', '#FF2E93', '#FF6B35']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{profile.initials ?? 'W'}</Text>
        </LinearGradient>

        <View style={styles.profileInfo}>
          <Text style={styles.displayName}>{profile.displayName ?? 'User'}</Text>
          <Text style={styles.email}>{profile.email ?? 'Not signed in'}</Text>
        </View>

        <Pressable
          style={styles.editButton}
          onPress={() =>
            toastSoon(
              'Edit profile',
              'Name and avatar editing will roll out soon. Your wallet addresses sync automatically.'
            )
          }
        >
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>

      {/* Account */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue} selectable>
            {profile.email ?? '-'}
          </Text>
        </View>
        <View style={[styles.infoRow, styles.infoDivider]}>
          <Text style={styles.infoLabel}>Card</Text>
          <Text style={styles.infoValue} selectable>
            {profile.panLastFour ? `···· ${profile.panLastFour}` : 'No card on device'}
          </Text>
        </View>
        <View style={[styles.infoRow, styles.infoDivider]}>
          <Text style={styles.infoLabel}>EVM</Text>
          <Text style={styles.infoValueMono} selectable numberOfLines={1}>
            {profile.evmAddress ? truncMiddle(profile.evmAddress) : '-'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Solana</Text>
          <Text style={styles.infoValueMono} selectable numberOfLines={1}>
            {profile.solanaAddress ? truncMiddle(profile.solanaAddress, 6, 4) : '-'}
          </Text>
        </View>
      </View>

      {/* Settings sections */}
      <ListRow
        icon={Zap}
        title="Upgrade to Aurora+"
        subtitle="Cashback & higher limits"
        showChevron
        onPress={() => toastSoon('Aurora+', 'Premium cashback is not yet live. Stay tuned.')}
        style={styles.firstRow}
      />

      <ListRow
        icon={Shield}
        title="Security & privacy"
        subtitle="Two-factor, devices"
        showChevron
        onPress={() =>
          toastSoon(
            'Security & privacy',
            'PIN is enforced when signing. App-wide biometric unlock arrives soon.'
          )
        }
        style={styles.rowGap}
      />

      <ListRow
        icon={Bell}
        title="Notifications"
        subtitle="Spend alerts & news"
        showChevron
        onPress={() =>
          toastSoon('Notifications', 'Configure spend alerts when push messaging goes live.')
        }
        style={styles.rowGap}
      />

      <ListRow
        icon={HelpCircle}
        title="Support"
        subtitle="Chat with the team"
        showChevron
        onPress={() =>
          toastSoon(
            'Support',
            'Use the Sign tab for wallet signatures. In-app chat support will arrive in a future release.'
          )
        }
        style={styles.rowGap}
      />

      {/* Sign out button */}
      <ActionButton
        label="Sign out"
        variant="ghost"
        icon={<LogOut size={18} color={tokens.colors.accent} strokeWidth={1.5} />}
        onPress={handleLogout}
        style={styles.logoutBtn}
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

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.lg,
    marginBottom: tokens.spacing.xl,
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.card,
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },

  profileInfo: {
    flex: 1,
  },

  displayName: {
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.lg,
    fontWeight: '600',
    marginBottom: tokens.spacing.xs,
  },

  email: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.sm,
    fontWeight: '400',
  },

  editButton: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.secondary,
  },

  editText: {
    color: tokens.colors.accent,
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
  },

  infoCard: {
    backgroundColor: tokens.colors.card,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
    ...tokens.shadows.soft,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.sm,
  },

  infoDivider: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    paddingBottom: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },

  infoLabel: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.25 * tokens.fontSize.xs,
    textTransform: 'uppercase',
  },

  infoValue: {
    flex: 1,
    marginLeft: tokens.spacing.md,
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
    textAlign: 'right',
  },

  infoValueMono: {
    flex: 1,
    marginLeft: tokens.spacing.md,
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    textAlign: 'right',
  },

  firstRow: {
    marginBottom: tokens.spacing.md,
  },

  rowGap: {
    marginTop: tokens.spacing.md,
  },

  logoutBtn: {
    marginTop: tokens.spacing.xl,
  },
});
