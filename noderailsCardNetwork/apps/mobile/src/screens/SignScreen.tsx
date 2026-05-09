import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import * as SecureStore from '../utils/secureStore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { tokens } from '../theme/tokens';
import { ActionButton } from '../components/ActionButton';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getApiBaseUrl } from '../config/apiBaseUrl';
import { ALL_WEB3_METHODS, assertSigningAllowed, loadWeb3CardPrefs } from '../utils/web3CardPrefs';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Read email claim from JWT (fallback if session email not stored). */
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

/** Mobile demo excludes serialized Solana tx (needs client-built wire); browser SDK can still request it. */
const METHODS = ALL_WEB3_METHODS.filter((m) => m !== 'solana_signTransaction');

const NETWORKS = [
  { label: 'Ethereum Mainnet', value: 'mainnet', chainId: 1 },
  { label: 'Sepolia Testnet', value: 'sepolia', chainId: 11155111 },
];

async function fetchWalletAddresses(apiUrl: string, token: string): Promise<{ evm?: string; solana?: string }> {
  const res = await fetch(`${apiUrl}/v1/wallet/accounts`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return {};
  const body = (await res.json()) as { data?: { chainFamily: string; address: string }[] };
  const accounts = body.data ?? [];
  const evm = accounts.find((a) => a.chainFamily === 'evm')?.address;
  const solana = accounts.find((a) => a.chainFamily === 'solana')?.address;
  return { evm, solana };
}

/** Minimal EIP-1193-shaped payloads for signer-host `performSign` (needs matching `from`, etc.). */
function buildDemoSigningPayload(
  method: string,
  chainId: number,
  evm?: string,
  sol?: string,
): Record<string, unknown> {
  if (method.startsWith('solana_')) {
    if (!sol) throw new Error('No Solana wallet. Finish onboarding first.');
    if (method === 'solana_signMessage') {
      return { from: sol, message: 'WallCard demo signature (NodeRails)', chainId };
    }
    throw new Error('Demo uses solana_signMessage only (serialized tx not bundled).');
  }
  if (!evm) throw new Error('No EVM wallet. Finish onboarding first.');
  const from = evm;
  const base: Record<string, unknown> = { from, chainId };
  switch (method) {
    case 'personal_sign':
      return { ...base, message: 'WallCard demo signature (NodeRails)' };
    case 'eth_sign':
      return { ...base, hash: `0x${'ab'.repeat(32)}` };
    case 'eth_signTypedData_v4':
      return {
        ...base,
        typedData: {
          domain: {
            name: 'WallCard Demo',
            version: '1',
            chainId,
            verifyingContract: '0x0000000000000000000000000000000000000000',
          },
          types: {
            Message: [{ name: 'contents', type: 'string' }],
          },
          primaryType: 'Message',
          message: { contents: 'WallCard demo' },
        },
      };
    case 'eth_signTransaction':
    case 'eth_sendTransaction':
      return {
        ...base,
        nonce: 0,
        to: from,
        value: '0',
        data: '0x',
        gas: 21000,
        gasPrice: 1_000_000_000,
      };
    default:
      throw new Error(`Unsupported demo method: ${method}`);
  }
}

export function SignScreen() {
  const nav = useNavigation<Nav>();
  const [method, setMethod] = useState<string>('personal_sign');
  const [network, setNetwork] = useState(NETWORKS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setLoading(true); setError('');
    try {
      const token = await SecureStore.getItemAsync('wallcard_auth_token');
      if (!token) throw new Error('not_authenticated');

      let email = await SecureStore.getItemAsync('wallcard_user_email');
      if (!email?.includes('@')) {
        email = emailFromAccessToken(token);
      }
      if (!email?.includes('@')) throw new Error('missing_email');

      const otpRes = await fetch(`${getApiBaseUrl()}/v1/auth/otp/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': `${Date.now()}` },
        body: JSON.stringify({ email, purpose: 'signing' }),
      });
      const otpBody = await otpRes.json().catch(() => ({}));
      if (!otpRes.ok) throw new Error(typeof otpBody.error === 'string' ? otpBody.error : 'otp_request_failed');
      const otpRequestedAt = Date.now();

      const prefs = await loadWeb3CardPrefs();
      assertSigningAllowed(method, prefs);

      const apiUrl = getApiBaseUrl();
      const { evm, solana } = await fetchWalletAddresses(apiUrl, token);

      // Create signing request
      const chain = method.startsWith('solana_') ? 'solana' : 'evm';
      const payload = buildDemoSigningPayload(method, network.chainId, evm, solana);
      const res = await fetch(`${apiUrl}/v1/signing-requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'idempotency-key': `${Date.now()}` },
        body: JSON.stringify({
          chain,
          method,
          payload,
          requestSource: 'mobile_app',
          requestOrigin: 'wallcard://sign-tab'
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'create_failed');
      nav.navigate('SignConfirm', {
        method,
        network: network.label,
        requestId: body.id,
        otpRequestedAt,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>Sign Request</Text>

      {/* Method picker */}
      <Text style={styles.sectionLabel}>Method</Text>
      <View style={styles.chips}>
        {METHODS.map((m) => (
          <Pressable key={m} onPress={() => setMethod(m)} style={[styles.chip, m === method && styles.chipActive]}>
            <Text style={[styles.chipText, m === method && styles.chipTextActive]}>{m}</Text>
          </Pressable>
        ))}
      </View>

      {/* Network selector */}
      <Text style={styles.sectionLabel}>Network</Text>
      <View style={styles.networkRow}>
        {NETWORKS.map((n) => (
          <Pressable key={n.value} onPress={() => setNetwork(n)} style={[styles.networkBtn, n.value === network.value && styles.networkBtnActive]}>
            <View style={[styles.radio, n.value === network.value && styles.radioActive]} />
            <Text style={[styles.networkLabel, n.value === network.value && styles.networkLabelActive]}>{n.label}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ActionButton label="Create Signing Request" onPress={handleCreate} loading={loading} style={styles.btn} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.bg },
  content: { paddingHorizontal: tokens.spacing.lg, paddingTop: 60, paddingBottom: 40 },
  pageTitle: { color: tokens.colors.text, fontSize: tokens.fontSize.xl, fontWeight: '700', marginBottom: tokens.spacing.lg },
  sectionLabel: { color: tokens.colors.textMuted, fontSize: tokens.fontSize.xs, fontWeight: '700', letterSpacing: 1, marginBottom: tokens.spacing.sm, marginTop: tokens.spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: tokens.radius.full, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface },
  chipActive: { borderColor: tokens.colors.accent, backgroundColor: tokens.colors.accentGlow },
  chipText: { color: tokens.colors.textMuted, fontSize: tokens.fontSize.xs, fontWeight: '600' },
  chipTextActive: { color: tokens.colors.accent },
  networkRow: { gap: tokens.spacing.sm },
  networkBtn: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, padding: tokens.spacing.md, borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface },
  networkBtnActive: { borderColor: tokens.colors.accent, backgroundColor: tokens.colors.accentGlow },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: tokens.colors.borderStrong },
  radioActive: { borderColor: tokens.colors.accent, backgroundColor: tokens.colors.accent },
  networkLabel: { color: tokens.colors.textMuted, fontSize: tokens.fontSize.sm, fontWeight: '600' },
  networkLabelActive: { color: tokens.colors.accent },
  error: { color: tokens.colors.danger, fontSize: tokens.fontSize.xs, marginVertical: tokens.spacing.sm },
  btn: { marginTop: tokens.spacing.lg },
});
