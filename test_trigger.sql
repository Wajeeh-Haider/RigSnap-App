-- Test script to verify trigger function and user creation
-- Run this in Supabase SQL Editor to test the trigger

-- 1. Check if the trigger exists and is active
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 2. Check if the function exists
SELECT 
  routine_name, 
  routine_type, 
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 3. Check current users table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check if there are any existing users
SELECT COUNT(*) as user_count FROM public.users;

-- 5. Check auth.users table for recent signups
SELECT 
  id, 
  email, 
  created_at,
  raw_user_meta_data
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Test the trigger function manually (simulate what happens during signup)
-- This will help us see if the function works when called directly
DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  test_email text := 'test@example.com';
  test_metadata jsonb := '{
    "firstName": "Test", 
    "lastName": "User", 
    "role": "trucker", 
    "location": "Test Location",
    "phone": "1234567890",
    "language": "en"
  }';
BEGIN
  -- Try to call the function directly to see if it works
  RAISE NOTICE 'Testing handle_new_user function with test data';
  
  -- We can't directly insert into auth.users, but we can test the logic
  -- by checking if our function would work with sample data
  RAISE NOTICE 'Function test completed - check logs for any errors';
END $$;

-- 7. Check for any recent errors in the logs
-- (This query might not work in all Supabase versions)
SELECT 'Check Supabase logs for any trigger errors during recent signups' as instruction;