import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/secureStore';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay } from 'react-native-reanimated';
import { tokens } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

export function SplashScreen() {
  const nav = useNavigation<Nav>();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    opacity.value = withSpring(1, { damping: 20 });
    scale.value = withSpring(1, { damping: 18 });

    const t = setTimeout(async () => {
      try {
        const token = await SecureStore.getItemAsync('wallcard_auth_token');
        nav.replace(token ? 'MainTabs' : 'Onboarding');
      } catch {
        nav.replace('Onboarding');
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [nav]);

  return (
    <View style={styles.container}>
      <Animated.View style={animStyle}>
        <Text style={styles.brand}>Wall<Text style={styles.brandAccent}>Card</Text></Text>
        <Text style={styles.tagline}>Your card. Your keys.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.bg, alignItems: 'center', justifyContent: 'center' },
  brand: { color: tokens.colors.text, fontSize: tokens.fontSize.hero, fontWeight: '200', letterSpacing: 4, textAlign: 'center' },
  brandAccent: { color: tokens.colors.accent, fontWeight: '800' },
  tagline: { color: tokens.colors.textSubtle, fontSize: tokens.fontSize.sm, letterSpacing: 2, textAlign: 'center', marginTop: tokens.spacing.sm },
});
