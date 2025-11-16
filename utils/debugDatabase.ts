// Debug function to check if requests are being saved
// You can run this in your app console or add it temporarily to check

import { supabase } from '../lib/supabase';

export const debugDatabaseCheck = async (userId: string) => {
  try {
    console.log('🔍 Checking database for user:', userId);
    
    // Check recent requests
    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .select('*')
      .eq('trucker_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (requestsError) {
      console.error('❌ Error fetching requests:', requestsError);
    } else {
      console.log('📋 Recent requests:', requests?.length || 0);
      requests?.forEach((req, index) => {
        console.log(`  ${index + 1}. ID: ${req.id}, Status: ${req.status}, Created: ${req.created_at}`);
      });
    }

    // Check recent payment transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (transactionsError) {
      console.error('❌ Error fetching transactions:', transactionsError);
    } else {
      console.log('💳 Recent transactions:', transactions?.length || 0);
      transactions?.forEach((txn, index) => {
        console.log(`  ${index + 1}. Amount: $${(txn.amount_cents / 100).toFixed(2)}, Type: ${txn.transaction_type}, Status: ${txn.status}`);
      });
    }

    // Check payment methods
    const { data: paymentMethods, error: pmError } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId);

    if (pmError) {
      console.error('❌ Error fetching payment methods:', pmError);
    } else {
      console.log('💎 Payment methods:', paymentMethods?.length || 0);
      paymentMethods?.forEach((pm, index) => {
        console.log(`  ${index + 1}. Card: **** ${pm.last4}, Brand: ${pm.card_brand}, Default: ${pm.is_default}`);
      });
    }

  } catch (error) {
    console.error('❌ Debug check failed:', error);
  }
};

// Usage: debugDatabaseCheck('your-user-id-here');