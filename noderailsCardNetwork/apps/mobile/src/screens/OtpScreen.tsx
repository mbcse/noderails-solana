import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as SecureStore from '../utils/secureStore';
import { tokens } from '../theme/tokens';
import { OtpInput } from '../components/OtpInput';
import { ActionButton } from '../components/ActionButton';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getApiBaseUrl } from '../config/apiBaseUrl';
import { saveCachedPrimaryCard, type CachedCard } from '../utils/cardCache';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Otp'>;
type Route = RouteProp<RootStackParamList, 'Otp'>;

export function OtpScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { email } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (otp.length < 6) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/auth/otp/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': `${Date.now()}` },
        body: JSON.stringify({ email, code: otp }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'otp_verify_failed');
      await SecureStore.setItemAsync('wallcard_auth_token', body.accessToken);
      await SecureStore.setItemAsync('wallcard_user_email', email);
      if (body.card) {
        try {
          await saveCachedPrimaryCard(body.card as CachedCard);
        } catch {
          /* ignore */
        }
      }
      if (body.needsSetup) {
        nav.replace('ProfileSetup', { token: body.accessToken });
      } else {
        nav.replace('MainTabs');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Verify</Text>
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.subtitle}>We sent a 6-digit code to <Text style={styles.email}>{email}</Text>.</Text>
          <OtpInput value={otp} onChange={v => { setOtp(v); setError(''); }} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ActionButton label="Verify & continue" onPress={handleVerify} loading={loading} disabled={otp.length < 6} style={styles.btn} />
          <ActionButton label="Use a different email" variant="ghost" onPress={() => nav.goBack()} style={styles.back} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: tokens.colors.background },
  container: { flexGrow: 1, paddingHorizontal: tokens.spacing.lg, paddingTop: 80, paddingBottom: 40, justifyContent: 'center' },
  card: { backgroundColor: tokens.colors.card, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, borderWidth: 1, borderColor: tokens.colors.border, ...tokens.shadows.soft },
  eyebrow: { color: tokens.colors.accent, fontSize: tokens.fontSize.xs, fontWeight: '700', letterSpacing: 0.32 * tokens.fontSize.xs, marginBottom: tokens.spacing.xs, textTransform: 'uppercase' },
  title: { color: tokens.colors.foreground, fontSize: tokens.fontSize.xl, fontWeight: '700', marginBottom: tokens.spacing.xs },
  subtitle: { color: tokens.colors['muted-foreground'], fontSize: tokens.fontSize.sm, lineHeight: 20, marginBottom: tokens.spacing.lg },
  email: { color: tokens.colors.foreground, fontWeight: '600' },
  error: { color: tokens.colors.danger, fontSize: tokens.fontSize.xs, marginTop: tokens.spacing.sm, textAlign: 'center' },
  btn: { marginTop: tokens.spacing.lg },
  back: { marginTop: tokens.spacing.sm },
});
