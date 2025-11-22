-- Enhanced debug queries based on your actual data

-- Check all transactions for specific request IDs that have cancellation penalties
SELECT 
    id,
    user_id,
    request_id,
    stripe_payment_intent_id,
    amount_cents,
    transaction_type,
    status,
    user_role,
    created_at,
    description
FROM payment_transactions 
WHERE request_id IN ('b68ab105-6931-4e98-a2c2-dfa547df36ad', 'ee58678c-6598-4aa5-9324-dfd6ba5e2372')
ORDER BY created_at DESC;

-- Check if there are any refund transactions (should be empty based on your data)
SELECT COUNT(*) as refund_count 
FROM payment_transactions 
WHERE transaction_type = 'refund';

-- Check the sequence of events for a specific request
SELECT 
    request_id,
    transaction_type,
    user_role,
    stripe_payment_intent_id,
    amount_cents,
    status,
    created_at,
    description
FROM payment_transactions 
WHERE request_id = 'b68ab105-6931-4e98-a2c2-dfa547df36ad'
ORDER BY created_at ASC;

-- Check for any transactions with suspicious payment intent IDs
SELECT 
    id,
    request_id,
    transaction_type,
    stripe_payment_intent_id,
    CASE 
        WHEN stripe_payment_intent_id IS NULL THEN 'NULL'
        WHEN stripe_payment_intent_id = '' THEN 'EMPTY_STRING'
        WHEN stripe_payment_intent_id = 'test_bypass' THEN 'TEST_BYPASS'
        WHEN stripe_payment_intent_id LIKE 'pi_%' THEN 'VALID_STRIPE'
        ELSE 'OTHER'
    END as intent_id_status
FROM payment_transactions 
WHERE stripe_payment_intent_id IS NULL 
   OR stripe_payment_intent_id = '' 
   OR stripe_payment_intent_id = 'test_bypass'
   OR stripe_payment_intent_id NOT LIKE 'pi_%';