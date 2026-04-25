import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useConfirmSetupIntent, CardField } from '@stripe/stripe-react-native';
import { paymentMethodService } from '@/utils/paymentOperations';
import { createSetupIntent } from '@/utils/stripe';
import { X, CreditCard } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AddPaymentMethodScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { confirmSetupIntent } = useConfirmSetupIntent();

  const [isLoading, setIsLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardholderName, setCardholderName] = useState('');

  const handleAddCard = async () => {
    if (!cardComplete || !cardholderName.trim()) {
      Alert.alert(
        'Error',
        'Please fill in all card details and cardholder name',
      );
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create a SetupIntent on the backend
      const setupIntentResponse = await createSetupIntent(user.id);

      if (!setupIntentResponse.success || !setupIntentResponse.client_secret) {
        Alert.alert('Error', 'Failed to initialize payment setup');
        setIsLoading(false);
        return;
      }

      console.log({
        client_secret: setupIntentResponse.client_secret,
        success: setupIntentResponse.success,
      });

      // Step 2: Confirm the SetupIntent with the card details
      const { error, setupIntent } = await confirmSetupIntent(
        setupIntentResponse.client_secret,
        {
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: {
              name: cardholderName.trim(),
            },
          },
        },
      );

      if (error) {
        console.log({ error });

        Alert.alert('Something went wrong. Please try again.', error.message);
        setIsLoading(false);
        return;
      }

      if (setupIntent?.status !== 'Succeeded') {
        Alert.alert('Something went wrong. Please try again.');
        setIsLoading(false);
        return;
      }

      // Step 3: Save the payment method to our database
      const paymentMethod = setupIntent.paymentMethod;
      if (!paymentMethod?.id) {
        Alert.alert('Error', 'Failed to create payment method');
        setIsLoading(false);
        return;
      }

      const cardBrand = paymentMethod.Card?.brand || 'unknown';
      const last4 = paymentMethod.Card?.last4 || '****';
      const expMonth = paymentMethod.Card?.expMonth || 0;
      const expYear = paymentMethod.Card?.expYear || 0;

      const result = await paymentMethodService.addPaymentMethod(
        user.id,
        paymentMethod.id,
        cardBrand,
        last4,
        expMonth,
        expYear,
        cardholderName.trim(),
      );

      if (result.success) {
        Alert.alert('Success', 'Payment method added successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to save payment method');
      }
    } catch (error) {
      console.error('Error adding payment method:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: colors.background, flex: 1, height: '100%' },
        ]}
      >
        <View style={{ flex: 1 }}>
          {/* ---------- HEADER ---------- */}
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.title, { color: colors.text }]}>
              Add Payment Method
            </Text>

            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.closeButton}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ---------- CONTENT ---------- */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              padding: 16,
              paddingBottom: 20, // Reduced since footer is separate now
              flexGrow: 1,
            }}
          >
            {/* Cardholder Name */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Cardholder Name
              </Text>

              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={cardholderName}
                onChangeText={setCardholderName}
                placeholder="John Doe"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
              />
            </View>

            {/* Card Form */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                Card Details
              </Text>

              <CardField
                style={{
                  width: '100%',
                  height: 50,
                  marginVertical: 8,
                }}
                cardStyle={{
                  backgroundColor: colors.surface,
                  textColor: colors.text,
                  placeholderColor: colors.textSecondary,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                }}
                placeholders={{
                  number: '1234 5678 9012 3456',
                }}
                postalCodeEnabled={false}
                onCardChange={(details) => {
                  setCardComplete(!!details.complete);
                }}
              />
            </View>

            {/* Security Notice */}
            <View
              style={[
                styles.securityNotice,
                {
                  backgroundColor: colors.success + '15',
                  borderColor: colors.success + '30',
                },
              ]}
            >
              <Text style={[styles.securityText, { color: colors.success }]}>
                Your payment information is encrypted and secure.
              </Text>
            </View>
          </ScrollView>

          {/* ---------- ACTIONS ---------- */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.background,
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.card }]}
              onPress={() => router.back()}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  { color: colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.addCardButton,
                { backgroundColor: colors.primary },
                (!cardComplete || !cardholderName.trim() || isLoading) &&
                  styles.addCardButtonDisabled,
              ]}
              onPress={handleAddCard}
              disabled={!cardComplete || !cardholderName.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <CreditCard size={16} color="white" />
              )}

              <Text style={styles.addCardButtonText}>
                {isLoading ? 'Adding Card...' : 'Add Card'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  securityNotice: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  securityText: {
    fontSize: 14,
    lineHeight: 20,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addCardButton: {
    flex: 2,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addCardButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  addCardButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
