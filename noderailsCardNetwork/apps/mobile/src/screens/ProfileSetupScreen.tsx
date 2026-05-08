import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { tokens } from '../theme/tokens';
import * as SecureStore from '../utils/secureStore';
import { PinInput } from '../components/PinInput';
import { ActionButton } from '../components/ActionButton';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getApiBaseUrl } from '../config/apiBaseUrl';
import { saveCachedPrimaryCard } from '../utils/cardCache';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProfileSetup'>;
type Route = RouteProp<RootStackParamList, 'ProfileSetup'>;

export function ProfileSetupScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { token } = route.params;
  const [fullName, setFullName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = fullName.trim().length > 0 && pin.length === 6;

  const handleSetup = async () => {
    if (!canSubmit) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/auth/onboarding/setup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'idempotency-key': `${Date.now()}` },
        body: JSON.stringify({ fullName: fullName.trim(), dobIso: '2000-01-01', pin }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'setup_failed');
      // Persist auth token locally in case it wasn't saved earlier.
      try {
        await SecureStore.setItemAsync('wallcard_auth_token', token);
        await SecureStore.setItemAsync('wallcard_display_name', fullName.trim());
      } catch {
        /* ignore */
      }
      try {
        if (body.card) await saveCachedPrimaryCard(body.card);
      } catch { /* ignore */ }
      nav.replace('MainTabs');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Almost there</Text>
          <Text style={styles.title}>Finish setup</Text>
          <Text style={styles.subtitle}>Set your display name and a 6-digit PIN to secure your card.</Text>
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={t => { setFullName(t); setError(''); }}
              placeholder="Your name"
              placeholderTextColor={tokens.colors.textSubtle}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Card PIN (6 digits)</Text>
            <PinInput value={pin} onChange={v => { setPin(v); setError(''); }} />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ActionButton label="Issue WallCard" onPress={handleSetup} loading={loading} disabled={!canSubmit} style={styles.btn} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: tokens.colors.bg },
  container: { flexGrow: 1, paddingHorizontal: tokens.spacing.lg, paddingTop: 80, paddingBottom: 40 },
  card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.xl, padding: tokens.spacing.lg, borderWidth: 1, borderColor: tokens.colors.border },
  eyebrow: { color: tokens.colors.accent, fontSize: tokens.fontSize.xs, fontWeight: '700', letterSpacing: 2, marginBottom: tokens.spacing.xs },
  title: { color: tokens.colors.text, fontSize: tokens.fontSize.xl, fontWeight: '700', marginBottom: tokens.spacing.xs },
  subtitle: { color: tokens.colors.textMuted, fontSize: tokens.fontSize.sm, lineHeight: 20, marginBottom: tokens.spacing.lg },
  fieldWrap: { marginBottom: tokens.spacing.lg },
  label: { color: tokens.colors.textMuted, fontSize: tokens.fontSize.xs, fontWeight: '600', marginBottom: tokens.spacing.sm },
  input: { backgroundColor: tokens.colors.bg, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radius.md, paddingHorizontal: tokens.spacing.md, paddingVertical: 14, color: tokens.colors.text, fontSize: tokens.fontSize.md },
  error: { color: tokens.colors.danger, fontSize: tokens.fontSize.xs, marginBottom: tokens.spacing.sm },
  btn: { marginTop: tokens.spacing.xs },
});
