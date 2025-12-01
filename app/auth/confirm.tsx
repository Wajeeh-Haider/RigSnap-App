import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function AuthConfirm() {
  useEffect(() => {
    // Since we're now using OTP instead of email confirmation links,
    // redirect users to the login screen
    console.log('Email confirmation links are no longer used, redirecting to login');
    router.replace('/(auth)/login');
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Redirecting...</Text>
      <Text style={styles.subText}>
        Email confirmation links are no longer used.{'\n'}
        Please use the OTP verification process instead.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  successText: {
    color: '#4CAF50',
  },
  errorText: {
    color: '#f44336',
  },
  subText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
});