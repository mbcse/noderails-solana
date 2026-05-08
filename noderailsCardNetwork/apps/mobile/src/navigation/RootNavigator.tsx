import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { tokens } from '../theme/tokens';
import { MainTabs } from './MainTabs';

// Placeholder screens will be replaced in tasks 9.x
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { ProfileSetupScreen } from '../screens/ProfileSetupScreen';
import { CardSettingsScreen } from '../screens/CardSettingsScreen';
import { SignConfirmScreen } from '../screens/SignConfirmScreen';

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Otp: { email: string };
  ProfileSetup: { token: string };
  MainTabs: undefined;
  SignConfirm: { method: string; network: string; requestId: string; otpRequestedAt?: number };
  CardSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.colors.bg },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="CardSettings"
        component={CardSettingsScreen}
        options={{
          headerShown: true,
          title: 'Payments & signing',
          headerTintColor: tokens.colors.accent,
          headerStyle: { backgroundColor: tokens.colors.background },
          headerTitleStyle: { color: tokens.colors.foreground, fontWeight: '700' },
          headerShadowVisible: false
        }}
      />
      <Stack.Screen name="SignConfirm" component={SignConfirmScreen} />
    </Stack.Navigator>
  );
}
