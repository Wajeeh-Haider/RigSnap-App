-- Fix Row Level Security for referrals table

-- Drop existing restrictive policies on referrals table
DROP POLICY IF EXISTS "Users can view their own referrals" ON referrals;
DROP POLICY IF EXISTS "Users can insert their own referrals" ON referrals;
DROP POLICY IF EXISTS "Allow referral creation" ON referrals;
DROP POLICY IF EXISTS "Allow referral reading" ON referrals;

-- Create more permissive policies for referrals table
CREATE POLICY "Allow referral creation" ON referrals
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow referral reading" ON referrals
FOR SELECT USING (true);

-- Ensure the process_referral_bonus function has proper security context
-- Drop existing conflicting functions first
DROP FUNCTION IF EXISTS process_referral_bonus(text, text);
DROP FUNCTION IF EXISTS process_referral_bonus(uuid, character varying);
DROP FUNCTION IF EXISTS process_referral_bonus(uuid, text);

-- Create the function with proper parameters
CREATE OR REPLACE FUNCTION process_referral_bonus(
  referred_user_id text,
  referral_code_used text
) RETURNS boolean
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  referrer_user_id text;
  referrer_exists boolean := false;
  referee_exists boolean := false;
  already_referred boolean := false;
BEGIN
  -- Check if the referred user exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id::text = referred_user_id) INTO referee_exists;
  IF NOT referee_exists THEN
    RETURN false;
  END IF;
  
  -- Check if referral code is valid and get referrer ID
  SELECT id::text INTO referrer_user_id 
  FROM users 
  WHERE referral_code = UPPER(referral_code_used);
  
  IF referrer_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user has already been referred
  SELECT EXISTS(
    SELECT 1 FROM referrals 
    WHERE referred_id::text = referred_user_id
  ) INTO already_referred;
  
  IF already_referred THEN
    RETURN false;
  END IF;
  
  -- Prevent self-referral
  IF referrer_user_id = referred_user_id THEN
    RETURN false;
  END IF;
  
  -- Create referral record
  INSERT INTO referrals (referrer_id, referred_id, referral_code, created_at)
  VALUES (referrer_user_id::uuid, referred_user_id::uuid, UPPER(referral_code_used), now());
  
  -- Add $10 credit to referrer in users table
  UPDATE users 
  SET credits = COALESCE(credits, 0) + 10.00, updated_at = now()
  WHERE id::text = referrer_user_id;
  
  -- Add $10 credit to referee in users table
  UPDATE users 
  SET credits = COALESCE(credits, 0) + 10.00, updated_at = now()
  WHERE id::text = referred_user_id;
  
  -- Record transaction for referrer
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, related_referral_id, created_at)
  VALUES (
    referrer_user_id::uuid, 
    10.00, 
    'earned', 
    'Referral bonus for inviting ' || (SELECT name FROM users WHERE id::text = referred_user_id),
    (SELECT id FROM referrals WHERE referrer_id::text = referrer_user_id AND referred_id::text = referred_user_id),
    now()
  );
  
  -- Record transaction for referee
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, related_referral_id, created_at)
  VALUES (
    referred_user_id::uuid, 
    10.00, 
    'earned', 
    'Signup bonus from referral code ' || UPPER(referral_code_used),
    (SELECT id FROM referrals WHERE referrer_id::text = referrer_user_id AND referred_id::text = referred_user_id),
    now()
  );
  
  RETURN true;
END;
$$;

-- Grant necessary permissions to authenticated users for referrals table
GRANT INSERT ON referrals TO authenticated;
GRANT SELECT ON referrals TO authenticated;

-- Ensure users table allows reading referral codes
DROP POLICY IF EXISTS "Allow reading referral codes" ON users;
CREATE POLICY "Allow reading referral codes" ON users
FOR SELECT USING (true);

-- Make sure the trigger function runs with elevated privileges
CREATE OR REPLACE FUNCTION generate_user_referral_code() 
RETURNS TRIGGER 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate referral code from first 3 letters of name + 3 random digits
  NEW.referral_code = UPPER(LEFT(REPLACE(NEW.name, ' ', ''), 3)) || LPAD(FLOOR(RANDOM() * 1000)::text, 3, '0');
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM users WHERE referral_code = NEW.referral_code) LOOP
    NEW.referral_code = UPPER(LEFT(REPLACE(NEW.name, ' ', ''), 3)) || LPAD(FLOOR(RANDOM() * 1000)::text, 3, '0');
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create the use_credits_for_payment function to support credit-first payments
CREATE OR REPLACE FUNCTION use_credits_for_payment(
  user_id uuid,
  total_amount numeric,
  request_id uuid DEFAULT NULL
) RETURNS TABLE(credits_used numeric, remaining_amount numeric, success boolean)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  current_balance numeric;
  credits_to_use numeric;
BEGIN
  -- Get current credit balance
  SELECT COALESCE(credits, 0) INTO current_balance 
  FROM users 
  WHERE id = user_id;
  
  -- Determine how much credits to use
  credits_to_use = LEAST(current_balance, total_amount);
  
  -- Update user credits if we're using any
  IF credits_to_use > 0 THEN
    UPDATE users 
    SET credits = credits - credits_to_use, updated_at = now()
    WHERE id = user_id;
    
    -- Record the credit transaction
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description, related_request_id, created_at)
    VALUES (
      user_id, 
      -credits_to_use, 
      'used', 
      CASE 
        WHEN request_id IS NOT NULL THEN 'Payment for request #' || request_id::text
        ELSE 'Payment using credits'
      END,
      request_id,
      now()
    );
  END IF;
  
  -- Return the results
  RETURN QUERY SELECT 
    credits_to_use as credits_used,
    total_amount - credits_to_use as remaining_amount,
    true as success;
END;
$$;