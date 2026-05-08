import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import * as SecureStore from '../utils/secureStore';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { tokens } from '../theme/tokens';
import { PinInput } from '../components/PinInput';
import { OtpInput } from '../components/OtpInput';
import { ActionButton } from '../components/ActionButton';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getApiBaseUrl } from '../config/apiBaseUrl';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SignConfirm'>;
type Route = RouteProp<RootStackParamList, 'SignConfirm'>;

/** Matches wallet iframe / Sign tab limits */
const OTP_RESEND_COOLDOWN_MS = 45_000;
const OTP_MAX_EMAILS_PER_SIGNING_FLOW = 6;

function emailFromAccessToken(token: string): string | null {
  try {
    const parts = token.split('.');
    const payload = parts[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    if (typeof globalThis.atob !== 'function') return null;
    const json = globalThis.atob(b64 + pad);
    const data = JSON.parse(json) as { email?: string };
    return typeof data.email === 'string' && data.email.includes('@') ? data.email : null;
  } catch {
    return null;
  }
}

export function SignConfirmScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { method, network, requestId, otpRequestedAt } = route.params;
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [otpEmailsSent, setOtpEmailsSent] = useState(1);
  const [lastOtpSentAt, setLastOtpSentAt] = useState(() => otpRequestedAt ?? Date.now());
  const [resendBusy, setResendBusy] = useState(false);
  const [resendHint, setResendHint] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const cooldownLeftMs = Math.max(0, lastOtpSentAt + OTP_RESEND_COOLDOWN_MS - Date.now());
  const cooldownSec = Math.ceil(cooldownLeftMs / 1000);
  const canResend =
    otpEmailsSent < OTP_MAX_EMAILS_PER_SIGNING_FLOW && cooldownLeftMs === 0 && !resendBusy && !success;

  const handleResendOtp = async () => {
    if (!canResend) return;
    setResendBusy(true);
    setError('');
    setResendHint(null);
    try {
      const token = await SecureStore.getItemAsync('wallcard_auth_token');
      if (!token) throw new Error('not_authenticated');
      let email = await SecureStore.getItemAsync('wallcard_user_email');
      if (!email?.includes('@')) email = emailFromAccessToken(token);
      if (!email?.includes('@')) throw new Error('missing_email');

      const otpRes = await fetch(`${getApiBaseUrl()}/v1/auth/otp/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': `${Date.now()}` },
        body: JSON.stringify({ email, purpose: 'signing' }),
      });
      const otpBody = await otpRes.json().catch(() => ({}));
      if (!otpRes.ok) throw new Error(typeof otpBody.error === 'string' ? otpBody.error : 'otp_request_failed');

      setOtpEmailsSent((n) => n + 1);
      setLastOtpSentAt(Date.now());
      setOtp('');
      setResendHint('A new code was sent to your email. Use the latest code.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend code');
    } finally {
      setResendBusy(false);
    }
  };

  const canSubmit = pin.length === 6 && otp.length === 6;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setLoading(true); setError('');
    try {
      const token = await SecureStore.getItemAsync('wallcard_auth_token');
      if (!token) throw new Error('not_authenticated');
      const res = await fetch(`${getApiBaseUrl()}/v1/signing-requests/${requestId}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'idempotency-key': `${Date.now()}` },
        body: JSON.stringify({ pin, useOtp: true, otpCode: otp }),
      });
      const body = await res.json();
      if (!res.ok) {
        const detail = typeof body.detail === 'string' ? body.detail : '';
        const msg = detail ? `${body.error ?? 'confirm_failed'}: ${detail}` : (body.error ?? 'confirm_failed');
        throw new Error(msg);
      }
      setSuccess(true);
      setTimeout(() => nav.goBack(), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Confirm Signature</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Method</Text>
          <Text style={styles.infoValue}>{method}</Text>
          <View style={styles.divider} />
          <Text style={styles.infoLabel}>Network</Text>
          <Text style={styles.infoValue}>{network}</Text>
        </View>

        {success ? (
          <View style={styles.successCard}>
            <Text style={styles.successText}>✓ Signed successfully</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Card PIN</Text>
            <PinInput value={pin} onChange={setPin} />

            <Text style={styles.sectionLabel}>One-time code</Text>
            <OtpInput value={otp} onChange={setOtp} />

            {resendHint ? <Text style={styles.resendHint}>{resendHint}</Text> : null}

            {otpEmailsSent >= OTP_MAX_EMAILS_PER_SIGNING_FLOW ? (
              <Text style={styles.resendLimit}>
                Maximum codes for this attempt ({OTP_MAX_EMAILS_PER_SIGNING_FLOW}). Go back, then create the request again
                to get more.
              </Text>
            ) : (
              <ActionButton
                label={
                  cooldownLeftMs > 0
                    ? `Resend code (${cooldownSec}s)`
                    : `Resend code (${OTP_MAX_EMAILS_PER_SIGNING_FLOW - otpEmailsSent} left)`
                }
                variant="ghost"
                onPress={() => void handleResendOtp()}
                loading={resendBusy}
                disabled={!canResend}
                style={styles.resendBtn}
              />
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <ActionButton
              label="Confirm & Sign"
              onPress={handleConfirm}
              loading={loading}
              disabled={!canSubmit}
              style={styles.btn}
            />
            <ActionButton label="Cancel" variant="ghost" onPress={() => nav.goBack()} style={styles.cancelBtn} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: tokens.colors.bg },
  content: { paddingHorizontal: tokens.spacing.lg, paddingTop: 60, paddingBottom: 40 },
  pageTitle: { color: tokens.colors.text, fontSize: tokens.fontSize.xl, fontWeight: '700', marginBottom: tokens.spacing.lg },
  infoCard: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.xl, borderWidth: 1, borderColor: tokens.colors.border, padding: tokens.spacing.md, marginBottom: tokens.spacing.lg },
  infoLabel: { color: tokens.colors.textSubtle, fontSize: tokens.fontSize.xs, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { color: tokens.colors.text, fontSize: tokens.fontSize.md, fontWeight: '600', marginBottom: tokens.spacing.sm },
  divider: { height: 1, backgroundColor: tokens.colors.border, marginVertical: tokens.spacing.sm },
  sectionLabel: { color: tokens.colors.textMuted, fontSize: tokens.fontSize.xs, fontWeight: '700', letterSpacing: 1, marginBottom: tokens.spacing.sm, marginTop: tokens.spacing.md },
  resendHint: { color: tokens.colors.success, fontSize: tokens.fontSize.xs, marginTop: tokens.spacing.sm, textAlign: 'center', lineHeight: 18 },
  resendBtn: { marginTop: tokens.spacing.sm, minHeight: 44, paddingVertical: 10 },
  resendLimit: { color: tokens.colors.textMuted, fontSize: tokens.fontSize.xs, marginTop: tokens.spacing.sm, textAlign: 'center', lineHeight: 18 },
  error: { color: tokens.colors.danger, fontSize: tokens.fontSize.xs, marginTop: tokens.spacing.sm, textAlign: 'center' },
  btn: { marginTop: tokens.spacing.lg },
  cancelBtn: { marginTop: tokens.spacing.sm },
  successCard: { backgroundColor: tokens.colors.successBg, borderRadius: tokens.radius.xl, padding: tokens.spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: `${tokens.colors.success}40` },
  successText: { color: tokens.colors.success, fontSize: tokens.fontSize.lg, fontWeight: '700' },
});
