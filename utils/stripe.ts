// Cleaned version without console logs
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../lib/supabase';

export const STRIPE_PUBLISHABLE_KEY = (process.env.EXPO_PUBLIC_STRIPE_PUBLISHED_KEY as string) || '';
const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'https://rigsnap-backend-vqqg.vercel.app';
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
  console.log('💳 chargeTruckerForRequest - STARTING CHARGE PROCESS');
  console.log('📋 Parameters:', { userId, requestId });

  if (BYPASS_PAYMENTS_FOR_TESTING) {
    console.log(
      '⚠️ chargeTruckerForRequest - TEST MODE - Bypassing actual charge'
    );
    return { success: true, payment_intent_id: 'test_bypass' };
  }

  console.log(
    '🔍 chargeTruckerForRequest - Fetching default payment method for user:',
    userId
  );
  const defaultPaymentMethod = await getDefaultPaymentMethod(userId);
  console.log('💳 Default payment method result:', defaultPaymentMethod);

  if (!defaultPaymentMethod) {
    console.log('❌ chargeTruckerForRequest - No default payment method found');
    return { success: false, error: 'No default payment method found' };
  }

  console.log(
    '✅ chargeTruckerForRequest - Payment method found, proceeding with charge'
  );
  console.log('💰 chargeTruckerForRequest - Charge details:', {
    amount: TRUCKER_REQUEST_FEE,
    paymentMethodId: defaultPaymentMethod.stripe_payment_method_id,
    description: `RigSnap Request Fee - Request #${requestId}`,
  });

  const result = await chargePaymentMethod(
    defaultPaymentMethod.stripe_payment_method_id,
    TRUCKER_REQUEST_FEE,
    `RigSnap Request Fee - Request #${requestId}`,
    userId
  );

  console.log('✅ chargeTruckerForRequest - Charge completed:', result);
  return result;
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

export const chargeProviderPenalty = async (
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
    5, // $5.00 penalty fee
    `RigSnap Cancellation Penalty - Request #${requestId}`,
    userId
  );
};

export const refundTrucker = async (
  userId: string,
  requestId: string,
  amount: number = 500 // $5.00 refund
): Promise<{
  success: boolean;
  error?: string;
  refund_id?: string;
}> => {
  console.log('🚀 refundTrucker - STARTING REFUND PROCESS');
  console.log('📋 Parameters:', { userId, requestId, amount });

  if (BYPASS_PAYMENTS_FOR_TESTING) {
    console.log('⚠️ refundTrucker - TEST MODE - Bypassing actual refund');
    return { success: true, refund_id: 'test_bypass' };
  }

  try {
    console.log('🔍 refundTrucker - Looking for payment transaction:', {
      userId,
      requestId,
    });

    // First, get the trucker's payment intent ID from the database
    console.log('🔍 refundTrucker - Building database query...');
    const { data: transactions, error } = await supabase
      .from('payment_transactions')
      .select(
        'stripe_payment_intent_id, status, amount_cents, description, transaction_type, created_at'
      )
      .eq('user_id', userId)
      .eq('request_id', requestId)
      .eq('transaction_type', 'acceptance_fee') // Only look for acceptance fees (trucker charged when provider accepts)
      .in('status', ['succeeded', 'pending']) // Check for both succeeded and pending payments
      .order('created_at', { ascending: false })
      .limit(1);

    console.log('🔍 refundTrucker - Database query completed');
    console.log(
      '🔍 refundTrucker - Found transactions:',
      JSON.stringify(transactions, null, 2)
    );
    console.log('🔍 refundTrucker - Query error:', error);
    console.log(
      '🔍 refundTrucker - Total transactions found:',
      transactions?.length || 0
    );

    if (error || !transactions || transactions.length === 0) {
      console.log('❌ refundTrucker - No trucker payment transaction found');
      console.log(
        '❌ refundTrucker - This means the trucker was not charged for this request'
      );
      console.log(
        '❌ refundTrucker - Returning success since no payment was made'
      );
      return { success: true, refund_id: 'no_payment_found' };
    }

    const paymentIntentId = transactions[0].stripe_payment_intent_id;
    const transactionStatus = transactions[0].status;
    const amountCents = transactions[0].amount_cents;
    const transactionType = transactions[0].transaction_type;
    const createdAt = transactions[0].created_at;

    console.log('🔍 refundTrucker - Transaction details:', {
      paymentIntentId,
      transactionStatus,
      amountCents,
      transactionType,
      createdAt,
      description: transactions[0].description,
    });

    // If payment is still pending, no refund needed
    if (transactionStatus === 'pending') {
      console.log(
        '⚠️ refundTrucker - Payment is still pending - no refund needed'
      );
      return { success: true, refund_id: 'payment_pending' };
    }

    // If payment intent ID is empty or test bypass, no actual refund needed
    if (
      !paymentIntentId ||
      paymentIntentId === 'test_bypass' ||
      paymentIntentId === ''
    ) {
      console.log(
        '⚠️ refundTrucker - No actual payment was processed - no refund needed'
      );
      console.log('⚠️ refundTrucker - Payment intent ID:', paymentIntentId);
      return { success: true, refund_id: 'no_actual_payment' };
    }

    // Validate that this is a valid Stripe payment intent ID
    if (!paymentIntentId.startsWith('pi_')) {
      console.log(
        '⚠️ refundTrucker - Invalid payment intent ID format:',
        paymentIntentId
      );
      console.log('⚠️ refundTrucker - Expected format: pi_xxxxxxxxxxxxx');
      return { success: true, refund_id: 'invalid_payment_intent' };
    }

    console.log('✅ refundTrucker - Payment intent validated successfully');
    console.log(
      '🔄 refundTrucker - Preparing to call Stripe backend for refund'
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    console.log('🔄 refundTrucker - Calling Stripe backend for refund:', {
      paymentIntentId,
      amount,
      backendUrl: `${BACKEND_URL}/api/stripe/create-refund`,
    });

    const response = await fetch(`${BACKEND_URL}/api/stripe/create-refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        payment_intent_id: paymentIntentId,
        amount: amount,
        reason: 'requested_by_customer',
        metadata: {
          request_id: requestId,
          refund_type: 'cancellation_refund',
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    console.log(
      '🔄 refundTrucker - Refund API response status:',
      response.status
    );
    console.log(
      '🔄 refundTrucker - Refund API response data:',
      JSON.stringify(data, null, 2)
    );

    if (!response.ok) {
      console.error('❌ refundTrucker - Refund API failed:', data.error);
      console.error('❌ refundTrucker - Full error response:', data);
      return { success: false, error: data.error || 'Refund failed' };
    }

    console.log('✅ refundTrucker - Refund successful!');
    console.log('✅ refundTrucker - Refund ID:', data.refund_id);
    return { success: true, refund_id: data.refund_id };
  } catch (error: any) {
    console.error('❌ refundTrucker - Caught exception:', error);
    console.error('❌ refundTrucker - Error name:', error.name);
    console.error('❌ refundTrucker - Error message:', error.message);

    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      console.error('❌ refundTrucker - Request timeout detected');
      return {
        success: false,
        error: 'Request timeout - Backend server is taking too long to respond',
      };
    }

    return { success: false, error: 'Network error' };
  } finally {
    console.log('🏁 refundTrucker - PROCESS COMPLETED');
  }
};
