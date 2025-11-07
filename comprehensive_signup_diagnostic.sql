-- Comprehensive Signup Diagnostic
-- Run this after attempting signup with saqlainch050@gmail.com

-- 1. Check if the user was created in auth.users
SELECT 'Checking if user exists in auth.users:' as info;
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users 
WHERE email = 'saqlainch050@gmail.com'
ORDER BY created_at DESC;

-- 2. Check if profile was created in public.users
SELECT 'Checking if profile exists in public.users:' as info;
SELECT 
  id,
  email,
  name,
  role,
  created_at
FROM public.users 
WHERE email = 'saqlainch050@gmail.com'
ORDER BY created_at DESC;

-- 3. Check recent auth.users entries (last 10)
SELECT 'Recent auth.users entries:' as info;
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created,
  CASE 
    WHEN u.id IS NOT NULL THEN 'Profile exists'
    ELSE 'NO PROFILE - TRIGGER FAILED'
  END as profile_status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
ORDER BY au.created_at DESC
LIMIT 10;

-- 4. Verify trigger function exists and check its definition
SELECT 'Checking trigger function definition:' as info;
SELECT 
  routine_name,
  routine_type,
  security_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 5. Verify trigger exists and is active
SELECT 'Checking trigger configuration:' as info;
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement,
  action_condition
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 6. Check current RLS policies on users table
SELECT 'Current RLS policies on users table:' as info;
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- 7. Check if RLS is enabled on users table
SELECT 'RLS status on users table:' as info;
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- 8. Test trigger function manually with a test user
DO $$
DECLARE
  test_auth_user_id uuid := gen_random_uuid();
  result_count integer;
BEGIN
  -- First, insert a test user into auth.users (simulating what Supabase does)
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  ) VALUES (
    test_auth_user_id,
    'trigger-test@example.com',
    'dummy_password',
    now(),
    now(),
    now(),
    '{}',
    '{}'
  );
  
  RAISE NOTICE 'Test auth user created with ID: %', test_auth_user_id;
  
  -- Wait a moment for trigger to execute
  PERFORM pg_sleep(1);
  
  -- Check if profile was created
  SELECT COUNT(*) INTO result_count
  FROM public.users 
  WHERE id = test_auth_user_id;
  
  IF result_count > 0 THEN
    RAISE NOTICE 'SUCCESS: Trigger created profile for test user';
  ELSE
    RAISE NOTICE 'FAILURE: Trigger did NOT create profile for test user';
  END IF;
  
  -- Clean up test data
  DELETE FROM public.users WHERE id = test_auth_user_id;
  DELETE FROM auth.users WHERE id = test_auth_user_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Manual trigger test failed: % - %', SQLSTATE, SQLERRM;
    -- Try to clean up even if there was an error
    DELETE FROM public.users WHERE id = test_auth_user_id;
    DELETE FROM auth.users WHERE id = test_auth_user_id;
END $$;

-- 9. Check for any database errors or logs
SELECT 'Checking for recent database errors:' as info;
-- Note: This might not work in all Supabase setups
SELECT 
  'Check Supabase Dashboard > Logs for detailed error information' as message;

-- 10. Final summary
SELECT 'Diagnostic Summary:' as info;
SELECT 
  'If user exists in auth.users but not in public.users, the trigger failed' as analysis_1,
  'If user does not exist in auth.users, the signup itself failed before reaching the trigger' as analysis_2,
  'Check the trigger function definition and RLS policies above for issues' as analysis_3;