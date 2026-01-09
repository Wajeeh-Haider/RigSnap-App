import * as React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';
import { StripeProvider } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from '@/utils/stripe';
import { SafeAreaView } from 'react-native-safe-area-context';

// Create a separate component for the Stack with SafeAreaView
function StackWithSafeArea() {
  const { colors } = useTheme();
  
  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background,
        height: '100%',
      }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Hide the Android bottom navigation bar
    NavigationBar.setVisibilityAsync('hidden');
    NavigationBar.setBehaviorAsync('overlay-swipe');
  }, []);
  useFrameworkReady();

  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <AppProvider>
            <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
              <StackWithSafeArea />
            </StripeProvider>
          </AppProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
