// Cleaned version without console logs
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../lib/supabase';

export const STRIPE_PUBLISHABLE_KEY =
  'pk_test_51STTDeHgLLh6TNiAZ6Psy2pPZ3qvptzL1JEhHuhzRrTTo0BTrE6aQgp35HnRNR7xHmy75u7zS5u9ZvaYwGFpxbvZ002gnzYpF6';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
console.log('asdasdasd', BACKEND_URL);
const BYPASS_PAYMENTS_FOR_TESTING = false;

export const TRUCKER_REQUEST_FEE = 5.0;
export const PROVIDER_ACCEPTANCE_FEE = 5.0;

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

export const createPaymentIntent = async (
  amount: number,
  currency: string = 'usd',
  description: string,
  userId: string
): Promise<CreatePaymentIntentResponse> => {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/stripe/create-payment-intent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency,
          description,
          userId,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to create payment intent',
      };
    }

    return { success: true, client_secret: data.client_secret };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
};

export const createSetupIntent = async (
  userId: string
): Promise<CreateSetupIntentResponse> => {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/stripe/setup-payment-method`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to create setup intent',
      };
    }

    return {
      success: true,
      client_secret: data.client_secret,
      setup_intent_id: data.setup_intent_id,
    };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
};

export const chargePaymentMethod = async (
  paymentMethodId: string,
  amount: number,
  description: string,
  userId: string
): Promise<ChargePaymentResponse> => {
  try {
    const requestBody = {
      payment_method_id: paymentMethodId,
      amount: Math.round(amount * 100),
      currency: 'usd',
      description,
      userId,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 10000);
    console.log('in chargePaymentMethod', BACKEND_URL);
    const response = await fetch(
      `${BACKEND_URL}/api/stripe/charge-payment-method`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Payment failed' };
    }

    return { success: true, payment_intent_id: data.payment_intent_id };
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return {
        success: false,
        error: 'Request timeout - Backend server is taking too long to respond',
      };
    }

    return { success: false, error: 'Network error' };
  }
};

export const getUserPaymentMethods = async (
  userId: string
): Promise<PaymentMethod[]> => {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return [];

    return data || [];
  } catch (error) {
    return [];
  }
};

export const getDefaultPaymentMethod = async (
  userId: string
): Promise<PaymentMethod | null> => {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single();

    if (error) return null;

    return data;
  } catch (error) {
    return null;
  }
};

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

    if (error) return { success: false, error: error.message };

    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Database error' };
  }
};

export const updatePaymentMethodDefault = async (
  paymentMethodId: string,
  isDefault: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('payment_methods')
      .update({ is_default: isDefault })
      .eq('id', paymentMethodId);

    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Database error' };
  }
};

export const deletePaymentMethod = async (
  paymentMethodId: string,
  stripePaymentMethodId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/stripe/detach-payment-method`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payment_method_id: stripePaymentMethodId }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Failed to detach from Stripe',
      };
    }

    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', paymentMethodId);

    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
};

export const chargeTruckerForRequest = async (
  userId: string,
  requestId: string
): Promise<{
  success: boolean;
  error?: string;
  payment_intent_id?: string;
}> => {
  if (BYPASS_PAYMENTS_FOR_TESTING) {
    return { success: true, payment_intent_id: 'test_bypass' };
  }
  console.warn(BACKEND_URL, 'asd');

  const defaultPaymentMethod = await getDefaultPaymentMethod(userId);
  console.warn('Default payment method:', defaultPaymentMethod);
  if (!defaultPaymentMethod) {
    return { success: false, error: 'No default payment method found' };
  }

  return await chargePaymentMethod(
    defaultPaymentMethod.stripe_payment_method_id,
    TRUCKER_REQUEST_FEE,
    `RigSnap Request Fee - Request #${requestId}`,
    userId
  );
};

export const chargeProviderForAcceptance = async (
  userId: string,
  requestId: string
): Promise<{
  success: boolean;
  error?: string;
  payment_intent_id?: string;
}> => {
  if (BYPASS_PAYMENTS_FOR_TESTING) {
    return { success: true, payment_intent_id: 'test_bypass' };
  }

  const defaultPaymentMethod = await getDefaultPaymentMethod(userId);

  if (!defaultPaymentMethod) {
    return { success: false, error: 'No default payment method found' };
  }

  return await chargePaymentMethod(
    defaultPaymentMethod.stripe_payment_method_id,
    PROVIDER_ACCEPTANCE_FEE,
    `RigSnap Acceptance Fee - Request #${requestId}`,
    userId
  );
};
