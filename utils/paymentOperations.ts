import { supabase } from '../lib/supabase';
import {
  getUserPaymentMethods,
  getDefaultPaymentMethod,
  createPaymentMethodInDB,
  updatePaymentMethodDefault,
  deletePaymentMethod,
  chargeTruckerForRequest,
  chargeProviderForAcceptance,
  PaymentMethod,
  authorizePaymentMethod,
  capturePaymentIntent,
} from './stripe';
import { useCreditsForPayment as applyCreditsForPayment, addCreditsToUser } from './creditOperations';

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
    isDefault?: boolean,
  ) => Promise<{ success: boolean; error?: string; data?: PaymentMethod }>;
  setDefaultPaymentMethod: (
    paymentMethodId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  removePaymentMethod: (
    paymentMethodId: string,
    stripePaymentMethodId: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

export interface RequestService {
  createRequestWithPayment: (
    requestData: any,
    userId: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    requestId?: string;
    requires_action?: boolean;
    client_secret?: string;
  }>;
  acceptRequestWithPayment: (
    requestId: string,
    providerId: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    requires_action?: boolean;
    client_secret?: string;
  }>;
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
    isDefault: boolean = false,
  ) => {
    return await createPaymentMethodInDB(
      userId,
      stripePaymentMethodId,
      cardBrand,
      last4,
      expMonth,
      expYear,
      cardholderName,
      isDefault,
    );
  },

  setDefaultPaymentMethod: async (paymentMethodId: string) => {
    return await updatePaymentMethodDefault(paymentMethodId, true);
  },

  removePaymentMethod: async (
    paymentMethodId: string,
    stripePaymentMethodId: string,
  ) => {
    return await deletePaymentMethod(paymentMethodId, stripePaymentMethodId);
  },
};

// Request Operations with Payment Integration
export const requestService: RequestService = {
  createRequestWithPayment: async (requestData: any, userId: string) => {
    try {
      // Enforce payment setup before request creation.
      // We only require at least one saved payment method here.
      const paymentMethods = await getUserPaymentMethods(userId);
      if (!paymentMethods.length) {
        return {
          success: false,
          error: 'Please add a payment method before creating a request.',
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

      // NEW: Apply credits now and authorize remaining amount (manual capture)
      // This prevents "card not found" later if trucker deletes their card.
      const truckerAmount = 5.0;
      const creditResult = await applyCreditsForPayment(
        userId,
        truckerAmount,
        'RigSnap Request Fee Authorization (Trucker)',
        request.id
      );

      if (!creditResult.success) {
        // Roll back request creation on credit failure
        await supabase.from('requests').delete().eq('id', request.id);
        return { success: false, error: creditResult.error || 'Failed to apply credits' };
      }

      if (creditResult.remainingAmount > 0) {
        const truckerPaymentMethod = await getDefaultPaymentMethod(userId);
        if (!truckerPaymentMethod) {
          // Roll back request creation and refund credits (if any used)
          await supabase.from('requests').delete().eq('id', request.id);
          if (creditResult.creditsUsed > 0) {
            await addCreditsToUser(
              userId,
              creditResult.creditsUsed,
              'refund',
              `Refund credits (request creation failed) - Request #${request.id}`,
              request.id
            );
          }
          return { success: false, error: 'No default payment method found' };
        }

        const authResult = await authorizePaymentMethod(
          truckerPaymentMethod.stripe_payment_method_id,
          creditResult.remainingAmount,
          `RigSnap Request Fee Authorization - Request #${request.id}`,
          userId,
          { request_id: request.id, user_role: 'trucker', kind: 'request_fee_auth' }
        );

        // Record the authorization intent for later capture
        if (authResult.payment_intent_id) {
          await supabase.from('payment_transactions').insert({
            user_id: userId,
            request_id: request.id,
            payment_method_id: truckerPaymentMethod.id,
            stripe_payment_intent_id: authResult.payment_intent_id,
            amount_cents: Math.round(creditResult.remainingAmount * 100),
            currency: 'usd',
            description: `RigSnap Request Fee Authorization (Trucker) - Request #${request.id}`,
            transaction_type: 'request_fee',
            status: authResult.requires_action ? 'pending' : 'pending',
            user_role: 'trucker',
            metadata: { capture_method: 'manual', kind: 'auth' },
          });
        }

        if (authResult.requires_action && authResult.client_secret) {
          return {
            success: false,
            requestId: request.id,
            requires_action: true,
            client_secret: authResult.client_secret,
            error: 'Authorization requires action',
          };
        }

        if (!authResult.success) {
          // Roll back request and refund credits
          await supabase.from('requests').delete().eq('id', request.id);
          if (creditResult.creditsUsed > 0) {
            await addCreditsToUser(
              userId,
              creditResult.creditsUsed,
              'refund',
              `Refund credits (authorization failed) - Request #${request.id}`,
              request.id
            );
          }
          return { success: false, error: authResult.error || 'Authorization failed' };
        }
      }

      // Send push notifications asynchronously (fire-and-forget)
      // This won't block the request creation
      supabase.functions
        .invoke('send-push-notifications', {
          body: {
            type: 'INSERT',
            table: 'requests',
            record: request,
            schema: 'public',
          },
        })
        .then((result) => {
          console.log('Push notifications sent successfully:', result);
        })
        .catch((error) => {
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

      // For acceptance, credits can fully cover fees.
      // Only require payment methods if credits are insufficient.
      const { getUserCredits } = await import('./creditOperations');
      const truckerCredits = await getUserCredits(currentRequest.trucker_id);
      const providerCredits = await getUserCredits(providerId);

      const truckerAmount = 5.0;
      const providerAmount = 5.0;

      const truckerHasSufficientCredits =
        (truckerCredits?.balance || 0) >= truckerAmount;
      const providerHasSufficientCredits =
        (providerCredits?.balance || 0) >= providerAmount;

      // If we already have a trucker authorization intent from request creation,
      // we should capture that at accept-time even if the trucker later deletes
      // their saved payment method.
      const { data: authTxns } = await supabase
        .from('payment_transactions')
        .select('id, stripe_payment_intent_id, amount_cents, status')
        .eq('user_id', currentRequest.trucker_id)
        .eq('request_id', requestId)
        .eq('transaction_type', 'request_fee')
        .order('created_at', { ascending: false })
        .limit(1);

      const authTransactionId = authTxns?.[0]?.id || null;
      const authIntentId = authTxns?.[0]?.stripe_payment_intent_id || null;
      const hasPriorTruckerAuth = Boolean(authIntentId);

      // Require trucker payment method only when trucker credits are insufficient
      // AND there is no prior authorization intent we can capture.
      if (!truckerHasSufficientCredits && !hasPriorTruckerAuth) {
        const truckerPaymentMethod = await getDefaultPaymentMethod(
          currentRequest.trucker_id,
        );
        if (!truckerPaymentMethod) {
          return {
            success: false,
            error:
              'Trucker has insufficient credits and no payment method. Request cannot be accepted.',
          };
        }
      }

      // Require provider payment method only when provider credits are insufficient
      if (!providerHasSufficientCredits) {
        const providerPaymentMethod = await getDefaultPaymentMethod(providerId);
        if (!providerPaymentMethod) {
          return {
            success: false,
            error:
              'Please add a payment method or sufficient credits before accepting a request.',
          };
        }
      }

      // Step 2: Charge the service provider for accepting the request
      console.log('Step 2: Attempting to charge provider for acceptance:', {
        providerId,
        requestId,
      });

      // Try to use credits first for provider payment
      const providerCreditResult = await applyCreditsForPayment(
        providerId,
        providerAmount,
        'RigSnap Acceptance Fee (Provider)', // Description (not used by DB function)
        requestId,
      );

      let providerPaymentResult: any = { success: false };

      if (
        providerCreditResult.success &&
        providerCreditResult.remainingAmount === 0
      ) {
        // Payment fully covered by credits
        console.log(
          'Provider payment fully covered by credits:',
          providerCreditResult.creditsUsed,
        );
        providerPaymentResult = { success: true, payment_intent_id: null };
      } else if (
        providerCreditResult.success &&
        providerCreditResult.remainingAmount > 0
      ) {
        // Partial payment with credits, charge remaining amount via Stripe
        console.log('Partial payment with credits:', {
          creditsUsed: providerCreditResult.creditsUsed,
          remainingAmount: providerCreditResult.remainingAmount,
        });
        providerPaymentResult = await chargeProviderForAcceptance(
          providerId,
          requestId,
          providerCreditResult.remainingAmount,
        );
      } else {
        // No credits available, charge full amount via Stripe
        providerPaymentResult = await chargeProviderForAcceptance(
          providerId,
          requestId,
          providerAmount,
        );
      }

      console.log('Provider payment result:', providerPaymentResult);

      if (!providerPaymentResult.success) {
        if (providerPaymentResult.requires_action && providerPaymentResult.client_secret) {
          // Provider must complete 3DS before we can proceed.
          return {
            success: false,
            requires_action: true,
            client_secret: providerPaymentResult.client_secret,
            error: 'Provider payment requires action',
          };
        }
        console.error('Provider payment failed:', providerPaymentResult.error);

        return {
          success: false,
          error: `Provider payment failed: ${providerPaymentResult.error}. Trucker has been refunded $5.`,
        };
      }

      // Step 3: Capture trucker authorization (if exists), otherwise fallback to charging trucker now.
      if (authIntentId) {
        const captureResult = await capturePaymentIntent(authIntentId);
        if (!captureResult.success) {
          return {
            success: false,
            error: `Trucker authorization capture failed. The authorization may have expired or requires re-authorization: ${captureResult.error || 'capture_failed'}`,
          };
        }

        // Keep the authorization transaction in sync after successful capture.
        if (authTransactionId) {
          await supabase
            .from('payment_transactions')
            .update({
              status: 'succeeded',
              description: `RigSnap Request Fee (Trucker) - Captured on acceptance - Request #${requestId}`,
              metadata: {
                capture_method: 'manual',
                kind: 'capture',
                captured_at: new Date().toISOString(),
              },
            })
            .eq('id', authTransactionId);
        }
      } else {
        // fallback: old behavior (charge trucker at acceptance)
        const truckerPay = await chargeTruckerForRequest(currentRequest.trucker_id, requestId, truckerAmount);
        if (!truckerPay.success) {
          return { success: false, error: `Trucker payment failed: ${truckerPay.error}` };
        }
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
          preUpdateError,
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
        const { data: postUpdateCheck } = await supabase
          .from('requests')
          .select('id, status, provider_id')
          .eq('id', requestId)
          .single();

        console.log('🔍 Post-update request check:', postUpdateCheck);
        console.warn(
          '⚠️ No rows were updated - checking RLS policies or constraints',
        );

        return {
          success: false,
          error: 'Request update failed - possible permission issue',
        };
      }

      console.log('📊 Updated request data:', updateData[0]);

      // Only create payment transaction record if there was an actual Stripe payment
      if (providerPaymentResult.payment_intent_id) {
        console.log('💳 Creating Stripe payment transaction record');

        // Get provider's payment method for transaction record
        const providerPaymentMethod = await getDefaultPaymentMethod(providerId);

        const { error: transactionError } = await supabase
          .from('payment_transactions')
          .insert({
            user_id: providerId,
            request_id: requestId,
            payment_method_id: providerPaymentMethod?.id || null,
            stripe_payment_intent_id: providerPaymentResult.payment_intent_id,
            amount_cents: 500, // $5.00 in cents
            description: `RigSnap Acceptance Fee (Provider) - Request #${requestId}`,
            transaction_type: 'acceptance_fee',
            user_role: 'provider',
            status: 'succeeded',
          });

        if (transactionError) {
          console.error(
            'Error creating payment transaction record:',
            transactionError,
          );
          // Don't fail the acceptance for this
        }
      } else {
        console.log(
          '💰 Payment covered by credits - no Stripe transaction record needed',
        );
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
