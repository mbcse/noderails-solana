import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { tokens } from '../theme/tokens';
import { InputField } from '../components/InputField';
import { ActionButton } from '../components/ActionButton';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getApiBaseUrl } from '../config/apiBaseUrl';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function OnboardingScreen() {
  const nav = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (!isValidEmail(email)) { setError('Enter a valid email address'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/auth/otp/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': `${Date.now()}` },
        body: JSON.stringify({ email, purpose: 'login' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'otp_request_failed');
      nav.navigate('Otp', { email });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Hero header */}
        <View style={styles.header}>
          <Text style={styles.tagline}>Crypto-first</Text>
          <Text style={styles.title}>Your wallet,</Text>
          {/* Solid accent line: RN LinearGradient wrapping Text varies by platform/native version and often washes out or hides glyphs. */}
          <Text style={styles.titleAccent}>in card form.</Text>
          <Text style={styles.subtitle}>
            WallCard turns your balance into a debit card you can spend anywhere, without the legacy networks.
          </Text>
        </View>

        {/* Auth card */}
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>Get started</Text>
          <Text style={styles.cardTitle}>Create your WallCard</Text>

          <InputField
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={t => { setEmail(t); setError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={error}
          />

          <ActionButton
            label="Continue with email"
            onPress={handleContinue}
            loading={loading}
            disabled={!email || !isValidEmail(email)}
            style={styles.btn}
          />
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon} accessibilityLabel="Instant">
              ⚡
            </Text>
            <Text style={styles.featureName}>Instant</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon} accessibilityLabel="Self-custody">
              🔒
            </Text>
            <Text style={styles.featureName}>Self-custody</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon} accessibilityLabel="No bank">
              ✨
            </Text>
            <Text style={styles.featureName}>No bank</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: tokens.colors.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: 60,
    paddingBottom: 40,
  },

  header: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xl,
  },

  tagline: {
    color: tokens.colors.accent,
    fontSize: tokens.fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.25 * tokens.fontSize.xs,
    textTransform: 'uppercase',
    marginBottom: tokens.spacing.sm,
  },

  title: {
    color: tokens.colors.foreground,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -0.02,
  },

  titleAccent: {
    marginTop: 2,
    color: tokens.colors['aurora-violet'],
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -0.02,
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.85)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 8,
  },

  subtitle: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.sm,
    lineHeight: 20,
    marginTop: tokens.spacing.md,
    textAlign: 'center',
  },

  card: {
    backgroundColor: tokens.colors.card,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginBottom: tokens.spacing.lg,
    ...tokens.shadows.soft,
  },

  cardEyebrow: {
    color: tokens.colors.accent,
    fontSize: tokens.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.32 * tokens.fontSize.xs,
    textTransform: 'uppercase',
    marginBottom: tokens.spacing.xs,
  },

  cardTitle: {
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.xl,
    fontWeight: '700',
    marginBottom: tokens.spacing.lg,
  },

  btn: {
    marginTop: tokens.spacing.lg,
  },

  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: tokens.colors.secondary,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
  },

  featureItem: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },

  featureIcon: {
    fontSize: 28,
  },

  featureName: {
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.xs,
    fontWeight: '600',
  },
});
