import { supabase } from '../lib/supabase';
import { Lead } from '@/types';

/**
 * Fetch all leads (payment transactions) for a specific user
 */
export const fetchUserLeads = async (userId: string): Promise<Lead[]> => {
  try {
    console.log('Fetching leads for user:', userId);

    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user leads:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('No leads found for user');
      return [];
    }

    // Convert payment transactions to Lead format
    const leads: Lead[] = data.map((transaction) => ({
      id: transaction.id,
      requestId: transaction.request_id || 'unknown',
      userId: transaction.user_id,
      userRole: transaction.user_role,
      amount: transaction.amount_cents / 100, // Convert cents to dollars
      status: mapTransactionStatusToLeadStatus(transaction.status),
      createdAt: transaction.created_at,
      description: transaction.description,
    }));

    console.log(`Found ${leads.length} leads for user ${userId}`);
    return leads;
  } catch (error) {
    console.error('Error in fetchUserLeads:', error);
    return [];
  }
};

/**
 * Fetch all leads (payment transactions) for all users (admin use)
 */
export const fetchAllLeads = async (): Promise<Lead[]> => {
  try {
    console.log('Fetching all leads');

    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all leads:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('No leads found');
      return [];
    }

    // Convert payment transactions to Lead format
    const leads: Lead[] = data.map((transaction) => ({
      id: transaction.id,
      requestId: transaction.request_id || 'unknown',
      userId: transaction.user_id,
      userRole: transaction.user_role,
      amount: transaction.amount_cents / 100, // Convert cents to dollars
      status: mapTransactionStatusToLeadStatus(transaction.status),
      createdAt: transaction.created_at,
      description: transaction.description,
    }));

    console.log(`Found ${leads.length} total leads`);
    return leads;
  } catch (error) {
    console.error('Error in fetchAllLeads:', error);
    return [];
  }
};

/**
 * Map transaction status to lead status
 */
const mapTransactionStatusToLeadStatus = (
  transactionStatus: string
): 'pending' | 'charged' | 'refunded' => {
  switch (transactionStatus) {
    case 'pending':
      return 'pending';
    case 'succeeded':
      return 'charged';
    case 'refunded':
      return 'refunded';
    case 'failed':
    case 'canceled':
      return 'refunded'; // Treat failed/canceled as refunded for UI purposes
    default:
      return 'pending';
  }
};

/**
 * Create a new lead (payment transaction)
 */
export const createLead = async (leadData: Omit<Lead, 'id' | 'createdAt'>): Promise<Lead | null> => {
  try {
    console.log('Creating new lead:', leadData);

    const { data, error } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: leadData.userId,
        request_id: leadData.requestId,
        amount_cents: Math.round(leadData.amount * 100), // Convert dollars to cents
        description: leadData.description,
        transaction_type: mapLeadToTransactionType(leadData.description),
        status: mapLeadStatusToTransactionStatus(leadData.status),
        user_role: leadData.userRole,
        stripe_payment_intent_id: `lead_${Date.now()}`, // Placeholder, should be replaced with actual Stripe ID
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      return null;
    }

    const newLead: Lead = {
      id: data.id,
      requestId: data.request_id || 'unknown',
      userId: data.user_id,
      userRole: data.user_role,
      amount: data.amount_cents / 100,
      status: mapTransactionStatusToLeadStatus(data.status),
      createdAt: data.created_at,
      description: data.description,
    };

    console.log('Lead created successfully:', newLead);
    return newLead;
  } catch (error) {
    console.error('Error in createLead:', error);
    return null;
  }
};

/**
 * Map lead description to transaction type
 */
const mapLeadToTransactionType = (description: string): string => {
  if (description.toLowerCase().includes('refund')) {
    return 'refund';
  } else if (description.toLowerCase().includes('penalty')) {
    return 'acceptance_fee'; // Penalties are charged as acceptance fees
  } else if (description.toLowerCase().includes('accept')) {
    return 'acceptance_fee';
  } else {
    return 'request_fee'; // Default to request fee
  }
};

/**
 * Map lead status to transaction status
 */
const mapLeadStatusToTransactionStatus = (
  leadStatus: string
): 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded' => {
  switch (leadStatus) {
    case 'pending':
      return 'pending';
    case 'charged':
      return 'succeeded';
    case 'refunded':
      return 'refunded';
    default:
      return 'pending';
  }
};