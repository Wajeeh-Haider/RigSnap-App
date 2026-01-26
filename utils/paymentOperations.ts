import { supabase } from '../lib/supabase';
import {
  getUserPaymentMethods,
  getDefaultPaymentMethod,
  createPaymentMethodInDB,
  updatePaymentMethodDefault,
  deletePaymentMethod,
  chargeTruckerForRequest,
  chargeProviderForAcceptance,
  refundTrucker,
  PaymentMethod,
} from './stripe';

export interface PaymentMethodService {
  fetchUserPaymentMethods: (userId: string) => Promise<PaymentMethod[]>;
  getDefaultMethod: (userId: string) => Promise<PaymentMethod | null>;
  addPaymentMethod: (
    userId: string,
    stripePaymentMethodId: string,
    cardBrand: string,
    last4: string,
    expMonth: number,
    expYear: number,
    cardholderName?: string,
    isDefault?: boolean
  ) => Promise<{ success: boolean; error?: string; data?: PaymentMethod }>;
  setDefaultPaymentMethod: (
    paymentMethodId: string
  ) => Promise<{ success: boolean; error?: string }>;
  removePaymentMethod: (
    paymentMethodId: string,
    stripePaymentMethodId: string
  ) => Promise<{ success: boolean; error?: string }>;
}

export interface RequestService {
  createRequestWithPayment: (
    requestData: any,
    userId: string
  ) => Promise<{ success: boolean; error?: string; requestId?: string }>;
  acceptRequestWithPayment: (
    requestId: string,
    providerId: string
  ) => Promise<{ success: boolean; error?: string }>;
}

// Payment Methods CRUD Operations
export const paymentMethodService: PaymentMethodService = {
  fetchUserPaymentMethods: async (userId: string) => {
    return await getUserPaymentMethods(userId);
  },

  getDefaultMethod: async (userId: string) => {
    return await getDefaultPaymentMethod(userId);
  },

  addPaymentMethod: async (
    userId: string,
    stripePaymentMethodId: string,
    cardBrand: string,
    last4: string,
    expMonth: number,
    expYear: number,
    cardholderName?: string,
    isDefault: boolean = false
  ) => {
    return await createPaymentMethodInDB(
      userId,
      stripePaymentMethodId,
      cardBrand,
      last4,
      expMonth,
      expYear,
      cardholderName,
      isDefault
    );
  },

  setDefaultPaymentMethod: async (paymentMethodId: string) => {
    return await updatePaymentMethodDefault(paymentMethodId, true);
  },

  removePaymentMethod: async (
    paymentMethodId: string,
    stripePaymentMethodId: string
  ) => {
    return await deletePaymentMethod(paymentMethodId, stripePaymentMethodId);
  },
};

// Request Operations with Payment Integration
export const requestService: RequestService = {
  createRequestWithPayment: async (requestData: any, userId: string) => {
    try {
      // Get user's default payment method
      const defaultPaymentMethod = await getDefaultPaymentMethod(userId);

      if (!defaultPaymentMethod) {
        return {
          success: false,
          error:
            'No default payment method found. Please add a payment method first.',
        };
      }

      // Create the request first
      const { data: request, error: requestError } = await supabase
        .from('requests')
        .insert({
          trucker_id: userId,
          location: requestData.location,
          coordinates: requestData.coordinates,
          service_type: requestData.service_type,
          urgency: requestData.urgency,
          description: requestData.description,
          estimated_cost: requestData.estimated_cost,
          photos: requestData.photos,
          status: 'pending',
        })
        .select()
        .single();

      if (requestError) {
        console.error('Error creating request:', requestError);
        return {
          success: false,
          error: `Failed to create request: ${requestError.message}`,
        };
      }

      // NOTE: Trucker is NOT charged when creating a request
      // The trucker will only be charged when a provider accepts their request
      console.log('Request created successfully - no charge applied to trucker');

      // Send push notifications asynchronously (fire-and-forget)
      // This won't block the request creation
      supabase.functions.invoke(
        'send-push-notifications',
        {
          body: {
            type: 'INSERT',
            table: 'requests',
            record: request,
            schema: 'public'
          }
        }
      ).then((result) => {
        console.log('Push notifications sent successfully:', result);
      }).catch((error) => {
        console.error('Failed to send push notifications:', error);
      });

      return {
        success: true,
        requestId: request.id,
      };
    } catch (error) {
      console.error('Error in createRequestWithPayment:', error);
      return {
        success: false,
        error: 'An unexpected error occurred',
      };
    }
  },

  acceptRequestWithPayment: async (requestId: string, providerId: string) => {
    try {
      // First, check the current status of the request
      const { data: currentRequest, error: fetchError } = await supabase
        .from('requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) {
        console.error('Error fetching request:', fetchError);
        return {
          success: false,
          error: 'Request not found',
        };
      }

      // Check if request is still available for acceptance
      if (currentRequest.status !== 'pending') {
        return {
          success: false,
          error: `Request is already ${currentRequest.status}`,
        };
      }

      // Get provider's default payment method
      const defaultPaymentMethod = await getDefaultPaymentMethod(providerId);

      if (!defaultPaymentMethod) {
        return {
          success: false,
          error:
            'No default payment method found. Please add a payment method first.',
        };
      }

      // NEW FLOW: First charge the trucker $5
      console.log('Step 1: Attempting to charge trucker for acceptance:', {
        truckerId: currentRequest.trucker_id,
        requestId,
        requestStatus: currentRequest.status,
      });
      
      // Check if trucker has any existing acceptance_fee transactions for this request
      const { data: existingTransactions } = await supabase
        .from('payment_transactions')
        .select('id, status, transaction_type, amount_cents, created_at')
        .eq('user_id', currentRequest.trucker_id)
        .eq('request_id', requestId)
        .eq('transaction_type', 'acceptance_fee')
        .order('created_at', { ascending: false });
      
      console.log('🔄 Existing acceptance_fee transactions for trucker:', existingTransactions);
      
      const truckerPaymentResult = await chargeTruckerForRequest(
        currentRequest.trucker_id,
        requestId
      );
      console.log('Trucker payment result:', truckerPaymentResult);

      // If payment failed, check if it's because of insufficient funds or card issues
      if (!truckerPaymentResult.success) {
        console.error('🚨 Trucker payment failed during re-acceptance:', truckerPaymentResult.error);
        
        // Check if there are any recent refunds that might affect the charge
        const { data: recentRefunds } = await supabase
          .from('payment_transactions')
          .select('id, status, transaction_type, amount_cents, created_at')
          .eq('user_id', currentRequest.trucker_id)
          .eq('request_id', requestId)
          .eq('transaction_type', 'refund')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
          .order('created_at', { ascending: false });
        
        console.log('🔄 Recent refund transactions:', recentRefunds);
        
        if (recentRefunds && recentRefunds.length > 0) {
          console.log('💡 Trucker had recent refunds - this might be causing payment issues');
        }
      }

      if (!truckerPaymentResult.success) {
        console.error('Trucker payment failed:', truckerPaymentResult.error);
        return {
          success: false,
          error: `Trucker payment failed: ${truckerPaymentResult.error}`,
        };
      }

      // Record trucker payment transaction
      const { error: truckerTransactionError } = await supabase
        .from('payment_transactions')
        .insert({
          user_id: currentRequest.trucker_id,
          request_id: requestId,
          payment_method_id: null, // Will be filled by chargeTruckerForRequest
          stripe_payment_intent_id: truckerPaymentResult.payment_intent_id || '',
          amount_cents: 500, // $5.00 in cents
          description: `RigSnap Acceptance Fee (Trucker) - Request #${requestId}`,
          transaction_type: 'acceptance_fee',
          user_role: 'trucker',
          status: 'succeeded',
        });

      if (truckerTransactionError) {
        console.error('Error creating trucker payment transaction record:', truckerTransactionError);
        // Continue with provider charging even if transaction record fails
      }

      console.log('Trucker payment successful, proceeding to charge provider');

      // Step 2: Charge the service provider for accepting the request
      console.log('Step 2: Attempting to charge provider for acceptance:', {
        providerId,
        requestId,
      });
      const providerPaymentResult = await chargeProviderForAcceptance(
        providerId,
        requestId
      );
      console.log('Provider payment result:', providerPaymentResult);

      if (!providerPaymentResult.success) {
        console.error('Provider payment failed:', providerPaymentResult.error);
        
        // REFUND LOGIC: If provider payment fails, refund the trucker
        console.log('🔄 Refunding trucker due to provider payment failure');
        const refundResult = await refundTrucker(
          currentRequest.trucker_id,
          requestId,
          500 // $5.00 refund
        );
        
        if (refundResult.success) {
          console.log('✅ Trucker refund successful');
        } else {
          console.error('❌ Trucker refund failed:', refundResult.error);
        }
        
        return {
          success: false,
          error: `Provider payment failed: ${providerPaymentResult.error}. Trucker has been refunded $5.`,
        };
      }

      console.log('Both payments successful, proceeding with request update');

      // First, check the current status again to debug
      const { data: preUpdateCheck, error: preUpdateError } = await supabase
        .from('requests')
        .select('id, status, provider_id')
        .eq('id', requestId)
        .single();

      console.log('🔍 Pre-update request check:', preUpdateCheck);

      if (preUpdateError) {
        console.error(
          '❌ Error checking request before update:',
          preUpdateError
        );
        return {
          success: false,
          error: `Request not found: ${preUpdateError.message}`,
        };
      }

      if (preUpdateCheck.status !== 'pending') {
        console.warn('⚠️ Request is not pending:', preUpdateCheck.status);
        return {
          success: false,
          error: `Request is already ${preUpdateCheck.status}`,
        };
      }

      // If payment is successful, update the request status
      console.log('Updating request status to accepted:', {
        requestId,
        providerId,
      });

      // Try update with status condition first
      let { data: updateData, error: updateError } = await supabase
        .from('requests')
        .update({
          provider_id: providerId,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('status', 'pending') // Ensure we only update if still pending
        .select();

      // If no rows updated, try without status condition (RLS policy issue workaround)
      if (!updateError && (!updateData || updateData.length === 0)) {
        console.log('🔄 Retrying update without status condition...');
        const retryResult = await supabase
          .from('requests')
          .update({
            provider_id: providerId,
            status: 'accepted',
            accepted_at: new Date().toISOString(),
          })
          .eq('id', requestId)
          .select();

        updateData = retryResult.data;
        updateError = retryResult.error;
        console.log('🔄 Retry result:', {
          data: updateData,
          error: updateError,
        });
      }

      if (updateError) {
        console.error('❌ Error accepting request:', updateError);
        return {
          success: false,
          error: `Failed to accept request: ${updateError.message}`,
        };
      }

      console.log('✅ Request status updated successfully:', updateData);

      if (!updateData || updateData.length === 0) {
        // Try to check what happened - maybe RLS policy issue
        const { data: postUpdateCheck, error: postUpdateError } = await supabase
          .from('requests')
          .select('id, status, provider_id')
          .eq('id', requestId)
          .single();

        console.log('🔍 Post-update request check:', postUpdateCheck);
        console.warn(
          '⚠️ No rows were updated - checking RLS policies or constraints'
        );

        return {
          success: false,
          error: 'Request update failed - possible permission issue',
        };
      }

      console.log('📊 Updated request data:', updateData[0]);

      // Create provider payment transaction record
      const { error: transactionError } = await supabase
        .from('payment_transactions')
        .insert({
          user_id: providerId,
          request_id: requestId,
          payment_method_id: defaultPaymentMethod.id,
          stripe_payment_intent_id: providerPaymentResult.payment_intent_id || '',
          amount_cents: 500, // $5.00 in cents
          description: `RigSnap Acceptance Fee (Provider) - Request #${requestId}`,
          transaction_type: 'acceptance_fee',
          user_role: 'provider',
          status: 'succeeded',
        });

      if (transactionError) {
        console.error(
          'Error creating payment transaction record:',
          transactionError
        );
        // Don't fail the acceptance for this
      }

      return { success: true };
    } catch (error) {
      console.error('Error in acceptRequestWithPayment:', error);
      return {
        success: false,
        error: 'An unexpected error occurred',
      };
    }
  },
};
