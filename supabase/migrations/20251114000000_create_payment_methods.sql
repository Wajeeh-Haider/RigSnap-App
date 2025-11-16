-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_method_id TEXT NOT NULL UNIQUE,
    card_brand TEXT NOT NULL,
    last4 TEXT NOT NULL,
    exp_month INTEGER NOT NULL,
    exp_year INTEGER NOT NULL,
    cardholder_name TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);

-- Create index on stripe_payment_method_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_id ON payment_methods(stripe_payment_method_id);

-- Enable RLS (Row Level Security)
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own payment methods
CREATE POLICY "Users can view own payment methods" ON payment_methods
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own payment methods
CREATE POLICY "Users can insert own payment methods" ON payment_methods
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own payment methods
CREATE POLICY "Users can update own payment methods" ON payment_methods
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own payment methods
CREATE POLICY "Users can delete own payment methods" ON payment_methods
    FOR DELETE USING (auth.uid() = user_id);

-- Function to ensure only one default payment method per user
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting a new default payment method
    IF NEW.is_default = TRUE THEN
        -- Set all other payment methods for this user to non-default
        UPDATE payment_methods 
        SET is_default = FALSE 
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to ensure only one default payment method per user
CREATE TRIGGER trigger_ensure_single_default_payment_method
    BEFORE INSERT OR UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_payment_method();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER trigger_update_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_methods_updated_at();