import * as React from 'react';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Appearance, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  followDeviceTheme: boolean;
  toggleFollowDeviceTheme: () => void;
  colors: {
    background: string;
    surface: string;
    card: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    shadow: string;
  };
}

const lightColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e5e7eb',
  primary: '#2563eb',
  secondary: '#ea580c',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  shadow: '#000000',
};

const darkColors = {
  background: '#111827',
  surface: '#1f2937',
  card: '#374151',
  text: '#f9fafb',
  textSecondary: '#d1d5db',
  border: '#4b5563',
  primary: '#3b82f6',
  secondary: '#f97316',
  success: '#22c55e',
  warning: '#eab308',
  error: '#f87171',
  shadow: '#000000',
};

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = '@rigsnap_theme';
const FOLLOW_DEVICE_THEME_KEY = '@rigsnap_follow_device_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [followDeviceTheme, setFollowDeviceTheme] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadThemePreferences();
  }, []);

  useEffect(() => {
    if (followDeviceTheme) {
      // Listen to device theme changes
      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        setIsDarkMode(colorScheme === 'dark');
      });

      // Listen to app state changes (when app comes back from background)
      const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          // Refresh theme when app becomes active
          const colorScheme = Appearance.getColorScheme();
          setIsDarkMode(colorScheme === 'dark');
        }
      });

      return () => {
        subscription.remove();
        appStateSubscription.remove();
      };
    }
  }, [followDeviceTheme]);

  const loadThemePreferences = async () => {
    try {
      // Load follow device theme preference
      const savedFollowDevice = await AsyncStorage.getItem(FOLLOW_DEVICE_THEME_KEY);
      const shouldFollowDevice = savedFollowDevice !== null ? JSON.parse(savedFollowDevice) : true;
      setFollowDeviceTheme(shouldFollowDevice);

      if (shouldFollowDevice) {
        // Use device theme
        const colorScheme = Appearance.getColorScheme();
        setIsDarkMode(colorScheme === 'dark');
      } else {
        // Load manual theme preference
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme !== null) {
          setIsDarkMode(JSON.parse(savedTheme));
        }
      }
    } catch (error) {
      console.error('Failed to load theme preferences:', error);
      // Fallback to device theme
      const colorScheme = Appearance.getColorScheme();
      setIsDarkMode(colorScheme === 'dark');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDarkMode = async () => {
    try {
      if (followDeviceTheme) {
        // If following device theme, turn it off and set manual theme
        setFollowDeviceTheme(false);
        await AsyncStorage.setItem(FOLLOW_DEVICE_THEME_KEY, JSON.stringify(false));
      }
      
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newTheme));
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  const toggleFollowDeviceTheme = async () => {
    try {
      const newFollowDevice = !followDeviceTheme;
      setFollowDeviceTheme(newFollowDevice);
      await AsyncStorage.setItem(FOLLOW_DEVICE_THEME_KEY, JSON.stringify(newFollowDevice));

      if (newFollowDevice) {
        // Switch to device theme
        const colorScheme = Appearance.getColorScheme();
        setIsDarkMode(colorScheme === 'dark');
      }
    } catch (error) {
      console.error('Failed to save follow device theme preference:', error);
    }
  };

  const colors = isDarkMode ? darkColors : lightColors;

  // Show loading state while determining initial theme
  if (isLoading) {
    return null; // Or you could return a loading spinner here
  }

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        toggleDarkMode,
        followDeviceTheme,
        toggleFollowDeviceTheme,
        colors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
