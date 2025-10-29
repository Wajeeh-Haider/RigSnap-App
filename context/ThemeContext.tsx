import * as React from 'react';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme !== null) {
        setIsDarkMode(JSON.parse(savedTheme));
      }
    } catch (error) {
      console.error('Failed to load theme preference:', error);
    }
  };

  const toggleDarkMode = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newTheme));
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        toggleDarkMode,
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
