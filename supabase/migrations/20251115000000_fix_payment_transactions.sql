-- Fix payment_transactions table migration with proper error handling
-- This migration handles cases where objects might already exist

-- Drop and recreate trigger to avoid conflicts
DROP TRIGGER IF EXISTS trigger_update_payment_transactions_updated_at ON payment_transactions;
DROP FUNCTION IF EXISTS update_payment_transactions_updated_at();

-- Create payment_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    stripe_payment_intent_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    description TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('request_fee', 'acceptance_fee', 'service_payment', 'refund')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled', 'refunded')),
    user_role TEXT NOT NULL CHECK (user_role IN ('trucker', 'provider')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_request_id ON payment_transactions(request_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_payment_intent_id ON payment_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_type ON payment_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts, then recreate
DROP POLICY IF EXISTS "Users can view own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can insert own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can update own payment transactions" ON payment_transactions;

-- Create RLS policies
CREATE POLICY "Users can view own payment transactions" ON payment_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment transactions" ON payment_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment transactions" ON payment_transactions
    FOR UPDATE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER trigger_update_payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_transactions_updated_at();

-- Drop and recreate functions to handle any signature changes
DROP FUNCTION IF EXISTS create_payment_transaction(UUID, UUID, UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS update_payment_transaction_status(TEXT, TEXT);

-- Function to create payment transaction record
CREATE OR REPLACE FUNCTION create_payment_transaction(
    p_user_id UUID,
    p_request_id UUID,
    p_payment_method_id UUID,
    p_stripe_payment_intent_id TEXT,
    p_amount_cents INTEGER,
    p_description TEXT,
    p_transaction_type TEXT,
    p_user_role TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    transaction_id UUID;
BEGIN
    INSERT INTO payment_transactions (
        user_id,
        request_id,
        payment_method_id,
        stripe_payment_intent_id,
        amount_cents,
        description,
        transaction_type,
        user_role,
        metadata
    ) VALUES (
        p_user_id,
        p_request_id,
        p_payment_method_id,
        p_stripe_payment_intent_id,
        p_amount_cents,
        p_description,
        p_transaction_type,
        p_user_role,
        p_metadata
    ) RETURNING id INTO transaction_id;
    
    RETURN transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update payment transaction status
CREATE OR REPLACE FUNCTION update_payment_transaction_status(
    p_stripe_payment_intent_id TEXT,
    p_status TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE payment_transactions 
    SET status = p_status, updated_at = NOW()
    WHERE stripe_payment_intent_id = p_stripe_payment_intent_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;