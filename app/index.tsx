import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

export default function IndexScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Add timeout to prevent infinite loading
  useEffect(() => {
    console.log('IndexScreen - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'user:', !!user);
    
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Loading timeout - redirecting to login');
      }
    }, 2000); // 2 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Show loading for a brief moment
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Redirect based on authentication state
  if (isAuthenticated) {
    console.log('Redirecting to tabs');
    return <Redirect href="/(tabs)" />;
  }

  console.log('Redirecting to login');
  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
});