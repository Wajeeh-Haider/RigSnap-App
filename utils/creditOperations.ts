import { supabase } from '../lib/supabase';

export interface UserCredits {
  id: string;
  user_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  request_id: string | null;
  referral_id: string | null;
  created_at: string;
}

// Get user's credit balance from users table
export const getUserCredits = async (userId: string): Promise<{ balance: number } | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user credits:', error);
      return null;
    }

    return { balance: data?.credits || 0 };
  } catch (error) {
    console.error('Error fetching user credits:', error);
    return null;
  }
};

// Get user's referral code from users table
export const getUserReferralCode = async (userId: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching referral code:', error);
      return null;
    }

    return data?.referral_code || null;
  } catch (error) {
    console.error('Error fetching referral code:', error);
    return null;
  }
};

// Validate referral code
export const validateReferralCode = async (code: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', code.toUpperCase())
      .single();

    if (error || !data) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating referral code:', error);
    return false;
  }
};

// Process referral bonus after successful signup
export const processReferralBonus = async (
  refereeUserId: string,
  referralCode: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.rpc('process_referral_bonus', {
      referred_user_id: refereeUserId,
      referral_code_used: referralCode.toUpperCase(),
    });

    if (error) {
      console.error('Error processing referral bonus:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Invalid referral code or user already referred' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error processing referral bonus:', error);
    return { success: false, error: 'Failed to process referral bonus' };
  }
};

// Use credits for payment and return remaining amount to charge
export const useCreditsForPayment = async (
  userId: string,
  amount: number,
  description: string,
  requestId?: string
): Promise<{ success: boolean; remainingAmount: number; creditsUsed: number; error?: string }> => {
  try {
    console.log('🔍 useCreditsForPayment called with:', {
      userId,
      amount,
      description,
      requestId
    });

    const { data, error } = await supabase.rpc('use_credits_for_payment', {
      user_id: userId,
      total_amount: amount,
      request_id: requestId
    });

    console.log('📊 useCreditsForPayment response:', { data, error });

    if (error) {
      console.error('Error using credits for payment:', error);
      return { 
        success: false, 
        remainingAmount: amount, 
        creditsUsed: 0, 
        error: error.message 
      };
    }

    // The function returns a row with credits_used, remaining_amount, success
    const result = data[0] || { credits_used: 0, remaining_amount: amount, success: true };
    const creditsUsed = result.credits_used || 0;
    
    console.log('🔬 Detailed type analysis:', {
      result,
      remaining_amount_value: result.remaining_amount,
      remaining_amount_type: typeof result.remaining_amount,
      is_number: typeof result.remaining_amount === 'number',
      originalAmount: amount
    });
    
    const remainingAmount = typeof result.remaining_amount === 'number' ? result.remaining_amount : amount;

    console.log('💰 Credit calculation result:', {
      creditsUsed,
      remainingAmount,
      originalAmount: amount
    });

    return { 
      success: true, 
      remainingAmount, 
      creditsUsed 
    };
  } catch (error) {
    console.error('Error using credits for payment:', error);
    return { 
      success: false, 
      remainingAmount: amount, 
      creditsUsed: 0, 
      error: 'Failed to use credits for payment' 
    };
  }
};

// Add credits to user (for refunds, bonuses, etc.)
export const addCreditsToUser = async (
  userId: string,
  amount: number,
  transactionType: string,
  description: string,
  requestId?: string,
  referralId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Update user credits
    // Note: supabase-js doesn't support `supabase.sql` here. Do a safe read-modify-write.
    const { data: userRow, error: fetchError } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching user credits for update:', fetchError);
      return { success: false, error: fetchError.message };
    }

    const currentCredits = typeof userRow?.credits === 'number' ? userRow.credits : 0;
    const nextCredits = currentCredits + amount;

    const { error: updateError } = await supabase
      .from('users')
      .update({
        credits: nextCredits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user credits:', updateError);
      return { success: false, error: updateError.message };
    }

    // Record transaction
    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount,
        transaction_type: transactionType,
        description,
        related_request_id: requestId,
        related_referral_id: referralId,
      });

    if (transactionError) {
      console.error('Error recording credit transaction:', transactionError);
      return { success: false, error: transactionError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error adding credits to user:', error);
    return { success: false, error: 'Failed to add credits' };
  }
};

// Get user's credit transaction history
export const getCreditTransactions = async (
  userId: string,
  limit: number = 50
): Promise<CreditTransaction[]> => {
  try {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching credit transactions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching credit transactions:', error);
    return [];
  }
};

// Check if user has enough credits for a payment
export const checkSufficientCredits = async (
  userId: string,
  amount: number
): Promise<{ sufficient: boolean; balance: number }> => {
  try {
    const userCredits = await getUserCredits(userId);
    const balance = userCredits?.balance || 0;
    
    return {
      sufficient: balance >= amount,
      balance,
    };
  } catch (error) {
    console.error('Error checking sufficient credits:', error);
    return { sufficient: false, balance: 0 };
  }
};

// Check if user can afford a payment (credits + payment method)
export const canUserAffordPayment = async (
  userId: string, 
  amount: number
): Promise<{ canAfford: boolean; hasCredits: boolean; hasSufficientCredits: boolean; hasPaymentMethod: boolean }> => {
  try {
    // Check user credits
    const creditsResult = await getUserCredits(userId);
    const creditBalance = creditsResult?.balance || 0;
    const hasSufficientCredits = creditBalance >= amount;
    
    // Check payment methods - only if credits are insufficient
    let hasPaymentMethod = false;
    if (!hasSufficientCredits) {
      const { getDefaultPaymentMethod } = await import('./stripe');
      const paymentMethod = await getDefaultPaymentMethod(userId);
      hasPaymentMethod = !!paymentMethod;
    } else {
      hasPaymentMethod = true; // Not needed if credits cover full amount
    }
    
    return {
      canAfford: hasSufficientCredits || hasPaymentMethod,
      hasCredits: creditBalance > 0,
      hasSufficientCredits,
      hasPaymentMethod: hasSufficientCredits ? true : hasPaymentMethod
    };
  } catch (error) {
    console.error('Error checking user affordability:', error);
    return {
      canAfford: false,
      hasCredits: false,
      hasSufficientCredits: false,
      hasPaymentMethod: false
    };
  }
};

// Get user's payment readiness status with friendly messages
export const getUserPaymentStatus = async (
  userId: string,
  amount: number,
  actionName: string = 'this action'
): Promise<{
  ready: boolean;
  message: string;
  requiresPaymentMethod: boolean;
  creditBalance: number;
}> => {
  const affordability = await canUserAffordPayment(userId, amount);
  const creditsResult = await getUserCredits(userId);
  const creditBalance = creditsResult?.balance || 0;
  
  if (affordability.hasSufficientCredits) {
    return {
      ready: true,
      message: `You can ${actionName} using your $${creditBalance.toFixed(2)} credit balance.`,
      requiresPaymentMethod: false,
      creditBalance
    };
  }
  
  if (affordability.hasCredits && affordability.hasPaymentMethod) {
    const remaining = amount - creditBalance;
    return {
      ready: true,
      message: `You'll use $${creditBalance.toFixed(2)} credits + $${remaining.toFixed(2)} from your payment method.`,
      requiresPaymentMethod: true,
      creditBalance
    };
  }
  
  if (!affordability.hasCredits && affordability.hasPaymentMethod) {
    return {
      ready: true,
      message: `You'll be charged $${amount.toFixed(2)} using your payment method.`,
      requiresPaymentMethod: true,
      creditBalance
    };
  }
  
  // Insufficient credits and no payment method
  const shortfall = amount - creditBalance;
  if (creditBalance > 0) {
    return {
      ready: false,
      message: `You have $${creditBalance.toFixed(2)} credits but need $${shortfall.toFixed(2)} more. Please add a payment method.`,
      requiresPaymentMethod: true,
      creditBalance
    };
  }
  
  return {
    ready: false,
    message: `You need $${amount.toFixed(2)} to ${actionName}. Please add credits or a payment method.`,
    requiresPaymentMethod: true,
    creditBalance
  };
};