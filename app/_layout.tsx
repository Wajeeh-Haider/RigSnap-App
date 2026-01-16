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
import { registerForPushNotificationsAsync } from '@/utils/pushNotifications';
import { requestLocationPermission } from '@/utils/location';

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
        <Stack.Screen
          name="add-payment-method"
          options={{ presentation: 'modal', headerShown: false }}
        />
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
  useEffect(() => {
    // Request both notification and location permissions on app launch
    const requestPermissions = async () => {
      try {
        console.log('Requesting app permissions...');
        
        // Request notification permissions
        await registerForPushNotificationsAsync();
        console.log('Notification permissions requested');
        
        // Request location permissions
        await requestLocationPermission();
        console.log('Location permissions requested');
        
      } catch (error) {
        console.log('Failed to request permissions:', error);
      }
    };

    // Add a small delay to ensure app is fully loaded
    setTimeout(requestPermissions, 1000);
  }, []);

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
