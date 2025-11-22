-- Debug query to check payment intent IDs and transaction details
-- This query will show you all payment transactions with their intent IDs

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
ORDER BY created_at DESC 
LIMIT 20;

-- Query to check specifically for trucker payments (request_fee) that might be missing intent IDs
SELECT 
    id,
    user_id,
    request_id,
    stripe_payment_intent_id,
    amount_cents,
    status,
    created_at,
    description
FROM payment_transactions 
WHERE transaction_type = 'request_fee' 
    AND (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id = '' OR stripe_payment_intent_id = 'test_bypass')
ORDER BY created_at DESC;

-- Query to check for provider payments (acceptance_fee) 
SELECT 
    id,
    user_id,
    request_id,
    stripe_payment_intent_id,
    amount_cents,
    status,
    created_at,
    description
FROM payment_transactions 
WHERE transaction_type = 'acceptance_fee' 
    AND (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id = '' OR stripe_payment_intent_id = 'test_bypass')
ORDER BY created_at DESC;

-- Query to check refund transactions
SELECT 
    id,
    user_id,
    request_id,
    stripe_payment_intent_id,
    amount_cents,
    status,
    created_at,
    description
FROM payment_transactions 
WHERE transaction_type = 'refund'
ORDER BY created_at DESC;