import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function AuthConfirm() {
  const { token_hash, type } = useLocalSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function verifyToken() {
      try {
        if (!token_hash || !type) {
          setStatus('error');
          setErrorMessage('Missing confirmation token');
          return;
        }

        console.log('Verifying auth token:', { token_hash, type });

        const { error } = await supabase.auth.verifyOtp({
          token_hash: token_hash as string,
          type: type as 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change' | 'phone_change',
        });

        if (error) {
          console.error('Token verification failed:', error);
          setStatus('error');
          setErrorMessage(error.message || 'Failed to verify token');
        } else {
          console.log('Token verification successful');
          setStatus('success');
          // Redirect to main app after successful confirmation
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 2000);
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setErrorMessage('An unexpected error occurred');
      }
    }

    verifyToken();
  }, [token_hash, type]);

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.text}>Confirming your email...</Text>
        </>
      )}
      
      {status === 'success' && (
        <>
          <Text style={[styles.text, styles.successText]}>✓ Email confirmed successfully!</Text>
          <Text style={styles.subText}>Redirecting to app...</Text>
        </>
      )}
      
      {status === 'error' && (
        <>
          <Text style={[styles.text, styles.errorText]}>✗ Confirmation failed</Text>
          <Text style={styles.subText}>{errorMessage}</Text>
        </>
      )}
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