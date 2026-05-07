import React, { useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { tokens } from '../theme/tokens';

interface OtpInputProps { value: string; onChange: (v: string) => void; length?: number; }

export function OtpInput({ value, onChange, length = 6 }: OtpInputProps) {
  const ref = useRef<TextInput>(null);
  const chars = value.padEnd(length, ' ').slice(0, length).split('');
  const handle = (text: string) => onChange(text.replace(/[^a-zA-Z0-9]/g, '').slice(0, length));
  return (
    <Pressable onPress={() => ref.current?.focus()} style={styles.wrap}>
      <TextInput ref={ref} value={value} onChangeText={handle} keyboardType="number-pad" autoComplete="one-time-code" maxLength={length} style={styles.hidden} caretHidden />
      <View style={styles.boxes}>
        {chars.map((c, i) => {
          const filled = c.trim().length > 0;
          const active = i === value.length;
          return (
            <View key={i} style={[styles.box, filled && styles.boxFilled, active && styles.boxActive]}>
              <Text style={styles.char}>{filled ? c : ''}</Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  hidden: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  boxes: { flexDirection: 'row', gap: tokens.spacing.md },
  box: { width: 48, height: 56, borderRadius: tokens.radius.sm, borderWidth: 2, borderColor: tokens.colors.border, backgroundColor: tokens.colors.card, alignItems: 'center', justifyContent: 'center' },
  boxFilled: { borderColor: tokens.colors['muted-foreground'], backgroundColor: tokens.colors.secondary },
  boxActive: { borderColor: tokens.colors.accent },
  char: { color: tokens.colors.foreground, fontSize: tokens.fontSize.xl, fontWeight: '600' },
});
