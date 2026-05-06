import React from 'react';
import {
  TextInput,
  StyleSheet,
  View,
  Text,
  type TextInputProps,
} from 'react-native';
import { tokens } from '../theme/tokens';

interface InputFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
}

export function InputField({
  label,
  error,
  helperText,
  placeholder,
  style,
  ...rest
}: InputFieldProps) {
  const hasError = !!error;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        {...rest}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors['muted-foreground']}
        style={[
          styles.input,
          hasError && styles.inputError,
          style,
        ]}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.sm,
  },

  label: {
    color: tokens.colors.foreground,
    fontSize: tokens.fontSize.sm,
    fontWeight: '600',
    letterSpacing: 0.25 * tokens.fontSize.sm,
    textTransform: 'uppercase',
  },

  input: {
    height: 52,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: tokens.fontSize.md,
    color: tokens.colors.foreground,
    fontWeight: '400',
  },

  inputError: {
    borderColor: tokens.colors.danger,
    backgroundColor: `${tokens.colors.danger}08`,
  },

  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.fontSize.xs,
    fontWeight: '500',
  },

  helperText: {
    color: tokens.colors['muted-foreground'],
    fontSize: tokens.fontSize.xs,
    fontWeight: '400',
  },
});
