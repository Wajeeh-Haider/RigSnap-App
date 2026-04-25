-- Create user credits table
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_earned DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_spent DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- Create referral codes table
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create referral relationships table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL,
  bonus_amount DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  credited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_referral UNIQUE(referee_id)
);

-- Create credit transactions table for tracking credit usage
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'referral_bonus', 'payment_deduction', 'refund'
  description TEXT,
  request_id UUID REFERENCES requests(id),
  referral_id UUID REFERENCES referrals(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backfill missing columns for environments with pre-existing legacy tables
ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS referee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS bonus_amount DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS credited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES requests(id),
  ADD COLUMN IF NOT EXISTS referral_id UUID REFERENCES referrals(id),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee_id ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);

-- Enable RLS on all tables
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_credits
DROP POLICY IF EXISTS "Users can view their own credits" ON user_credits;
CREATE POLICY "Users can view their own credits" ON user_credits
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own credits" ON user_credits;
CREATE POLICY "Users can update their own credits" ON user_credits
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert credits" ON user_credits;
CREATE POLICY "System can insert credits" ON user_credits
  FOR INSERT WITH CHECK (true);

-- RLS Policies for referral_codes  
DROP POLICY IF EXISTS "Users can view their own referral codes" ON referral_codes;
CREATE POLICY "Users can view their own referral codes" ON referral_codes
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own referral codes" ON referral_codes;
CREATE POLICY "Users can insert their own referral codes" ON referral_codes
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own referral codes" ON referral_codes;
CREATE POLICY "Users can update their own referral codes" ON referral_codes
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for referrals
DROP POLICY IF EXISTS "Users can view referrals they're involved in" ON referrals;
CREATE POLICY "Users can view referrals they're involved in" ON referrals
  FOR SELECT USING (referrer_id = auth.uid() OR referee_id = auth.uid());

DROP POLICY IF EXISTS "System can insert referrals" ON referrals;
CREATE POLICY "System can insert referrals" ON referrals
  FOR INSERT WITH CHECK (true);

-- RLS Policies for credit_transactions
DROP POLICY IF EXISTS "Users can view their own credit transactions" ON credit_transactions;
CREATE POLICY "Users can view their own credit transactions" ON credit_transactions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert credit transactions" ON credit_transactions;
CREATE POLICY "System can insert credit transactions" ON credit_transactions
  FOR INSERT WITH CHECK (true);

-- Function to generate unique referral code
DROP FUNCTION IF EXISTS generate_referral_code();
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INTEGER;
  code_exists BOOLEAN;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE referral_codes.code = code) INTO code_exists;
    
    IF NOT code_exists THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create referral code for new user
DROP FUNCTION IF EXISTS create_user_referral_code();
CREATE OR REPLACE FUNCTION create_user_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
  VALUES (NEW.id, 0.00, 0.00, 0.00);
  
  INSERT INTO referral_codes (user_id, code)
  VALUES (NEW.id, generate_referral_code());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to process referral bonus
DROP FUNCTION IF EXISTS process_referral_bonus(UUID, TEXT);
CREATE OR REPLACE FUNCTION process_referral_bonus(referee_user_id UUID, referral_code_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  referrer_user_id UUID;
  bonus_amount DECIMAL(10,2) := 10.00;
  referral_row_id UUID;
BEGIN
  -- Find the referrer
  SELECT user_id INTO referrer_user_id 
  FROM referral_codes 
  WHERE code = referral_code_param AND is_active = true;
  
  IF referrer_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Don't allow self-referral
  IF referrer_user_id = referee_user_id THEN
    RETURN false;
  END IF;
  
  -- Check if user already has a referral
  IF EXISTS(SELECT 1 FROM referrals WHERE referee_id = referee_user_id) THEN
    RETURN false;
  END IF;
  
  -- Create referral record
  INSERT INTO referrals (referrer_id, referee_id, referral_code, bonus_amount)
  VALUES (referrer_user_id, referee_user_id, referral_code_param, bonus_amount)
  RETURNING id INTO referral_row_id;
  
  -- Add credits to referrer
  UPDATE user_credits 
  SET balance = balance + bonus_amount,
      total_earned = total_earned + bonus_amount,
      updated_at = NOW()
  WHERE user_id = referrer_user_id;
  
  -- Add credits to referee 
  UPDATE user_credits 
  SET balance = balance + bonus_amount,
      total_earned = total_earned + bonus_amount,
      updated_at = NOW()
  WHERE user_id = referee_user_id;
  
  -- Record credit transactions
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, referral_id)
  VALUES 
    (referrer_user_id, bonus_amount, 'referral_bonus', 'Referral bonus for referring new user', referral_row_id),
    (referee_user_id, bonus_amount, 'referral_bonus', 'Referral bonus for joining with referral code', referral_row_id);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to use credits for payment
DROP FUNCTION IF EXISTS use_user_credits(UUID, DECIMAL, TEXT, UUID);
CREATE OR REPLACE FUNCTION use_user_credits(user_id_param UUID, amount_param DECIMAL(10,2), description_param TEXT, request_id_param UUID DEFAULT NULL)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  current_balance DECIMAL(10,2);
  amount_to_deduct DECIMAL(10,2);
  remaining_amount DECIMAL(10,2);
BEGIN
  -- Get current balance
  SELECT balance INTO current_balance 
  FROM user_credits 
  WHERE user_id = user_id_param;
  
  IF current_balance IS NULL THEN
    current_balance := 0;
  END IF;
  
  -- Calculate how much we can deduct from credits
  amount_to_deduct := LEAST(current_balance, amount_param);
  remaining_amount := amount_param - amount_to_deduct;
  
  -- Update credits if we're deducting anything
  IF amount_to_deduct > 0 THEN
    UPDATE user_credits 
    SET balance = balance - amount_to_deduct,
        total_spent = total_spent + amount_to_deduct,
        updated_at = NOW()
    WHERE user_id = user_id_param;
    
    -- Record transaction
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description, request_id)
    VALUES (user_id_param, -amount_to_deduct, 'payment_deduction', description_param, request_id_param);
  END IF;
  
  -- Return the remaining amount that needs to be charged via Stripe
  RETURN remaining_amount;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create referral code for new users
DROP TRIGGER IF EXISTS trigger_create_user_referral_code ON auth.users;
CREATE TRIGGER trigger_create_user_referral_code
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_referral_code();