import * as React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput } from 'react-native';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';
import { StripeProvider } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from '@/utils/stripe';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { requestLocationPermission } from '@/utils/location';
import { setCustomText, setCustomTextInput } from 'react-native-global-props';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';

// Create a separate component for the Stack with SafeAreaView
function StackWithSafeArea() {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const toastBackground = isDarkMode ? '#0f172a' : '#fff7ed';
  const toastText = isDarkMode ? '#e2e8f0' : '#7c2d12';
  const toastInfoBorder = isDarkMode ? '#38bdf8' : '#fb923c';
  const toastSuccessBorder = isDarkMode ? '#4ade80' : '#16a34a';
  const toastErrorBorder = isDarkMode ? '#f87171' : '#dc2626';

  const toastConfig = React.useMemo(
    () => ({
      info: (props: any) => (
        <BaseToast
          {...props}
          style={{
            borderLeftColor: toastInfoBorder,
            backgroundColor: toastBackground,
            borderRadius: 12,
          }}
          contentContainerStyle={{ paddingHorizontal: 12 }}
          text1Style={{
            fontFamily: 'Poppins_500Medium',
            fontSize: 14,
            color: toastText,
          }}
          text1NumberOfLines={3}
        />
      ),
      success: (props: any) => (
        <BaseToast
          {...props}
          style={{
            borderLeftColor: toastSuccessBorder,
            backgroundColor: toastBackground,
            borderRadius: 12,
          }}
          contentContainerStyle={{ paddingHorizontal: 12 }}
          text1Style={{
            fontFamily: 'Poppins_500Medium',
            fontSize: 14,
            color: toastText,
          }}
          text1NumberOfLines={3}
        />
      ),
      error: (props: any) => (
        <ErrorToast
          {...props}
          style={{
            borderLeftColor: toastErrorBorder,
            backgroundColor: toastBackground,
            borderRadius: 12,
          }}
          contentContainerStyle={{ paddingHorizontal: 12 }}
          text1Style={{
            fontFamily: 'Poppins_500Medium',
            fontSize: 14,
            color: toastText,
          }}
          text2Style={{
            fontFamily: 'Poppins_400Regular',
            fontSize: 12,
            color: toastText,
          }}
          text1NumberOfLines={3}
          text2NumberOfLines={3}
        />
      ),
    }),
    [toastBackground, toastErrorBorder, toastInfoBorder, toastSuccessBorder, toastText],
  );

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
      <StatusBar
        style={isDarkMode ? 'light' : 'dark'}
        backgroundColor={colors.background}
      />
      <Toast
        config={toastConfig}
        position="top"
        topOffset={insets.top + 12}
        visibilityTime={5000}
      />
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (!fontsLoaded) return;

    const globalTextProps = {
      style: { fontFamily: 'Poppins_500Medium' },
    };

    setCustomText(globalTextProps as any);
    setCustomTextInput(globalTextProps as any);

    // Keep defaultProps fallback for components that bypass global-props internals.
    const GlobalText = Text as any;
    const GlobalTextInput = TextInput as any;

    GlobalText.defaultProps = GlobalText.defaultProps || {};
    GlobalText.defaultProps.style = [
      { fontFamily: 'Poppins_500Medium' },
      GlobalText.defaultProps.style,
    ];

    GlobalTextInput.defaultProps = GlobalTextInput.defaultProps || {};
    GlobalTextInput.defaultProps.style = [
      { fontFamily: 'Poppins_500Medium' },
      GlobalTextInput.defaultProps.style,
    ];
  }, [fontsLoaded]);

  useEffect(() => {
    // Hide the Android bottom navigation bar
    NavigationBar.setVisibilityAsync('hidden');
    NavigationBar.setBehaviorAsync('overlay-swipe');
  }, []);

  useFrameworkReady();
  useEffect(() => {
    // Request location permissions on app launch
    const requestPermissions = async () => {
      try {
        console.log('Requesting location permissions...');

        // Request location permissions
        await requestLocationPermission();
        console.log('Location permissions requested');
      } catch (error) {
        console.log('Failed to request location permissions:', error);
      }
    };

    // Add a small delay to ensure app is fully loaded
    setTimeout(requestPermissions, 1000);
  }, []);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <AppProvider>
            {STRIPE_PUBLISHABLE_KEY ? (
              <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
                <StackWithSafeArea />
              </StripeProvider>
            ) : (
              <StackWithSafeArea />
            )}
          </AppProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
