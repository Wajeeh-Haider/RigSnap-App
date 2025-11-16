import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../lib/supabase';

// Stripe publishable key - replace with your actual key
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51STTDeHgLLh6TNiAZ6Psy2pPZ3qvptzL1JEhHuhzRrTTo0BTrE6aQgp35HnRNR7xHmy75u7zS5u9ZvaYwGFpxbvZ002gnzYpF6';

// Backend API URL configuration
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

// Temporary flag to bypass payments for testing when backend is not available
const BYPASS_PAYMENTS_FOR_TESTING = false;

// Payment constants
export const TRUCKER_REQUEST_FEE = 5.00; // $5 for creating a request
export const PROVIDER_ACCEPTANCE_FEE = 5.00; // $5 for accepting a request

export interface PaymentMethod {
  id: string;
  user_id: string;
  stripe_payment_method_id: string;
  card_brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  cardholder_name: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentIntentResponse {
  success: boolean;
  client_secret?: string;
  error?: string;
}

export interface ChargePaymentResponse {
  success: boolean;
  payment_intent_id?: string;
  error?: string;
}

export interface CreateSetupIntentResponse {
  success: boolean;
  client_secret?: string;
  setup_intent_id?: string;
  error?: string;
}

// Create a payment intent for one-time payment
export const createPaymentIntent = async (
  amount: number,
  currency: string = 'usd',
  description: string,
  userId: string
): Promise<CreatePaymentIntentResponse> => {
  try {
    // Call your backend API to create payment intent
    const response = await fetch(`${BACKEND_URL}/api/stripe/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        description,
        userId,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to create payment intent' };
    }

    return { success: true, client_secret: data.client_secret };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return { success: false, error: 'Network error' };
  }
};

// Create a setup intent for saving payment methods
export const createSetupIntent = async (userId: string): Promise<CreateSetupIntentResponse> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/stripe/setup-payment-method`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to create setup intent' };
    }

    return { 
      success: true, 
      client_secret: data.client_secret,
      setup_intent_id: data.setup_intent_id 
    };
  } catch (error) {
    console.error('Error creating setup intent:', error);
    return { success: false, error: 'Network error' };
  }
};

// Charge a payment method for one-time payment
export const chargePaymentMethod = async (
  paymentMethodId: string,
  amount: number,
  description: string,
  userId: string
): Promise<ChargePaymentResponse> => {
  try {
    // Call your backend API to charge the payment method
    const response = await fetch(`${BACKEND_URL}/api/stripe/charge-payment-method`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment_method_id: paymentMethodId,
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        description,
        userId,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Payment failed' };
    }

    return { success: true, payment_intent_id: data.payment_intent_id };
  } catch (error: any) {
    console.error('Error charging payment method:', error);
    if (error.message?.includes('Failed to fetch') || error.code === 'NETWORK_REQUEST_FAILED') {
      return { success: false, error: 'Network error - Backend server not accessible' };
    }
    return { success: false, error: 'Network error' };
  }
};

// Get user's payment methods from database
export const getUserPaymentMethods = async (userId: string): Promise<PaymentMethod[]> => {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment methods:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return [];
  }
};

// Get user's default payment method
export const getDefaultPaymentMethod = async (userId: string): Promise<PaymentMethod | null> => {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single();

    if (error) {
      console.error('Error fetching default payment method:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching default payment method:', error);
    return null;
  }
};

// Create payment method in database after successful Stripe creation
export const createPaymentMethodInDB = async (
  userId: string,
  stripePaymentMethodId: string,
  cardBrand: string,
  last4: string,
  expMonth: number,
  expYear: number,
  cardholderName: string | null = null,
  isDefault: boolean = false
): Promise<{ success: boolean; error?: string; data?: PaymentMethod }> => {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        user_id: userId,
        stripe_payment_method_id: stripePaymentMethodId,
        card_brand: cardBrand,
        last4,
        exp_month: expMonth,
        exp_year: expYear,
        cardholder_name: cardholderName,
        is_default: isDefault,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating payment method in DB:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error creating payment method in DB:', error);
    return { success: false, error: 'Database error' };
  }
};

// Update payment method default status
export const updatePaymentMethodDefault = async (
  paymentMethodId: string,
  isDefault: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('payment_methods')
      .update({ is_default: isDefault })
      .eq('id', paymentMethodId);

    if (error) {
      console.error('Error updating payment method default:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating payment method default:', error);
    return { success: false, error: 'Database error' };
  }
};

// Delete payment method from database and Stripe
export const deletePaymentMethod = async (
  paymentMethodId: string,
  stripePaymentMethodId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // First detach from Stripe
    const response = await fetch(`${BACKEND_URL}/api/stripe/detach-payment-method`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment_method_id: stripePaymentMethodId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'Failed to detach from Stripe' };
    }

    // Then delete from database
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', paymentMethodId);

    if (error) {
      console.error('Error deleting payment method from DB:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting payment method:', error);
    return { success: false, error: 'Network error' };
  }
};

// Charge trucker for creating a request
export const chargeTruckerForRequest = async (
  userId: string,
  requestId: string
): Promise<{ success: boolean; error?: string; payment_intent_id?: string }> => {
  // Bypass payments for testing if flag is enabled
  if (BYPASS_PAYMENTS_FOR_TESTING) {
    console.log('BYPASS_PAYMENTS_FOR_TESTING enabled - skipping payment for testing');
    return { success: true, payment_intent_id: 'test_bypass' };
  }

  const defaultPaymentMethod = await getDefaultPaymentMethod(userId);
  
  if (!defaultPaymentMethod) {
    console.log('No default payment method found for user:', userId);
    return { success: false, error: 'No default payment method found' };
  }

  const result = await chargePaymentMethod(
    defaultPaymentMethod.stripe_payment_method_id,
    TRUCKER_REQUEST_FEE,
    `RigSnap Request Fee - Request #${requestId}`,
    userId
  );

  return result;
};

// Charge service provider for accepting a request
export const chargeProviderForAcceptance = async (
  userId: string,
  requestId: string
): Promise<{ success: boolean; error?: string; payment_intent_id?: string }> => {
  // Bypass payments for testing if flag is enabled
  if (BYPASS_PAYMENTS_FOR_TESTING) {
    console.log('BYPASS_PAYMENTS_FOR_TESTING enabled - skipping payment for testing');
    return { success: true, payment_intent_id: 'test_bypass' };
  }

  const defaultPaymentMethod = await getDefaultPaymentMethod(userId);
  
  if (!defaultPaymentMethod) {
    console.log('No default payment method found for provider:', userId);
    return { success: false, error: 'No default payment method found' };
  }

  const result = await chargePaymentMethod(
    defaultPaymentMethod.stripe_payment_method_id,
    PROVIDER_ACCEPTANCE_FEE,
    `RigSnap Acceptance Fee - Request #${requestId}`,
    userId
  );

  return result;
};