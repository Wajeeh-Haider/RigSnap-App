import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Mail,
  ArrowLeft,
  CheckCircle,
  RefreshCw,
} from 'lucide-react-native';

export default function VerifyOtpScreen() {
  const { email } = useLocalSearchParams<{
    email: string;
  }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { verifyOtp, resendOtp } = useAuth();
  const { colors } = useTheme();
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    if (!email) {
      Alert.alert('Error', 'Email is required for OTP verification');
      router.back();
      return;
    }

    // Auto-send OTP when component mounts (for users redirected from login)
    const autoSendOtp = async () => {
      try {
        console.log('Auto-sending OTP for unverified user:', email);
        const result = await resendOtp(email);
        if (result.success) {
          console.log('OTP sent automatically to:', email);
        } else {
          console.log('Failed to auto-send OTP:', result.error);
        }
      } catch (error) {
        console.error('Error auto-sending OTP:', error);
      }
    };

    autoSendOtp();

    // Start countdown timer
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [email, resendOtp]);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle pasted OTP
      const otpArray = value.slice(0, 6).split('');
      const newOtp = [...otp];
      otpArray.forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit;
      });
      setOtp(newOtp);
      
      // Focus last filled input or next empty one
      const nextIndex = Math.min(otpArray.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      // Handle single digit input
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Auto-focus next input
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit code');
      return;
    }

    if (isVerified) {
      // Already verified, just redirect
      router.replace('/(tabs)');
      return;
    }

    setIsLoading(true);
    try {
      const result = await verifyOtp(email, otpString);
      
      if (result.success) {
        setIsVerified(true);
        Alert.alert('Success', 'Email verified successfully!', [
          {
            text: 'Continue',
            onPress: () => {
              router.replace('/(tabs)');
            },
          },
        ]);
      } else {
        Alert.alert('Verification Failed', result.error || 'Invalid or expired code. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsResending(true);
    try {
      const result = await resendOtp(email);
      
      if (result.success) {
        Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
        setResendTimer(60);
        setCanResend(false);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert('Failed to Resend', result.error || 'Could not resend verification code. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const isOtpComplete = otp.every(digit => digit !== '');

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ArrowLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>
              Verify Email
            </Text>
          </View>

          <View style={[styles.content, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
            <View style={styles.iconContainer}>
              <Mail size={48} color={colors.primary} />
            </View>

            <Text style={[styles.heading, { color: colors.text }]}>
              Check your email
            </Text>
            
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          We've sent a 6-digit verification code to{'\n'}
          <Text style={{ color: colors.primary, fontWeight: '600' }}>{email}</Text>
          {'\n\n'}
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>
            Please verify your email to continue using RigSnap
          </Text>
        </Text>            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    if (ref) inputRefs.current[index] = ref;
                  }}
                  style={[
                    styles.otpInput,
                    {
                      backgroundColor: colors.card,
                      borderColor: digit ? colors.primary : colors.border,
                      color: colors.text,
                    },
                    digit && { borderWidth: 2 },
                  ]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, index)}
                  keyboardType="numeric"
                  maxLength={index === 0 ? 6 : 1} // Allow paste on first input
                  textAlign="center"
                  selectTextOnFocus
                  autoFocus={index === 0}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.verifyButton,
                { backgroundColor: isVerified ? colors.success || '#4CAF50' : colors.primary },
                (!isOtpComplete || isLoading) && !isVerified && styles.buttonDisabled,
              ]}
              onPress={handleVerifyOtp}
              disabled={(!isOtpComplete || isLoading) && !isVerified}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : isVerified ? (
                <>
                  <CheckCircle size={20} color="white" />
                  <Text style={styles.verifyButtonText}>Continue to App</Text>
                </>
              ) : (
                <>
                  <CheckCircle size={20} color="white" />
                  <Text style={styles.verifyButtonText}>Verify Code</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              {!canResend ? (
                <Text style={[styles.timerText, { color: colors.textSecondary }]}>
                  Resend code in {resendTimer}s
                </Text>
              ) : (
                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={handleResendOtp}
                  disabled={isResending}
                >
                  {isResending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <RefreshCw size={16} color={colors.primary} />
                      <Text style={[styles.resendText, { color: colors.primary }]}>
                        Resend Code
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.helpText, { color: colors.textSecondary }]}>
              Didn't receive the code? Check your spam folder or try resending.
            </Text>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  innerContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    width: '100%',
    maxWidth: 300,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 40,
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 14,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});