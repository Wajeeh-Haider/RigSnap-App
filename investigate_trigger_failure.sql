-- Investigate Trigger Function Failure
-- This will help us understand why the trigger is failing

-- 1. Get the exact trigger function definition
SELECT 'Current trigger function definition:' as info;
SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 2. Check if the trigger function has proper permissions
SELECT 'Trigger function permissions:' as info;
SELECT 
  routine_name,
  security_type,
  definer_rights,
  sql_data_access,
  is_deterministic
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 3. Test the trigger function directly with a known user ID
DO $$
DECLARE
  test_user_record RECORD;
  existing_auth_user_id uuid;
BEGIN
  -- Get an existing auth user that doesn't have a profile
  SELECT au.id INTO existing_auth_user_id
  FROM auth.users au
  LEFT JOIN public.users u ON au.id = u.id
  WHERE u.id IS NULL
  LIMIT 1;
  
  IF existing_auth_user_id IS NOT NULL THEN
    RAISE NOTICE 'Testing trigger function with existing auth user: %', existing_auth_user_id;
    
    -- Get the user record from auth.users
    SELECT * INTO test_user_record FROM auth.users WHERE id = existing_auth_user_id;
    
    -- Try to call the trigger function directly
    PERFORM handle_new_user();
    
    RAISE NOTICE 'Trigger function called successfully';
    
  ELSE
    RAISE NOTICE 'No auth users without profiles found for testing';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Direct trigger function call failed: % - %', SQLSTATE, SQLERRM;
END $$;

-- 4. Check what happens when we try to insert into public.users manually
DO $$
DECLARE
  test_auth_user RECORD;
BEGIN
  -- Get the first auth user without a profile
  SELECT * INTO test_auth_user
  FROM auth.users au
  LEFT JOIN public.users u ON au.id = u.id
  WHERE u.id IS NULL
  LIMIT 1;
  
  IF test_auth_user.id IS NOT NULL THEN
    RAISE NOTICE 'Attempting manual insert for user: % (%)', test_auth_user.email, test_auth_user.id;
    
    -- Try to manually insert what the trigger should insert
    INSERT INTO public.users (
      id,
      email,
      name,
      role,
      location,
      language,
      rating,
      join_date,
      created_at,
      updated_at
    ) VALUES (
      test_auth_user.id,
      test_auth_user.email,
      COALESCE(test_auth_user.raw_user_meta_data->>'name', split_part(test_auth_user.email, '@', 1)),
      'trucker', -- default role
      'Unknown', -- default location
      'en', -- default language
      0, -- default rating
      CURRENT_DATE,
      now(),
      now()
    );
    
    RAISE NOTICE 'SUCCESS: Manual insert worked for user %', test_auth_user.email;
    
    -- Clean up the test insert
    DELETE FROM public.users WHERE id = test_auth_user.id;
    RAISE NOTICE 'Test data cleaned up';
    
  ELSE
    RAISE NOTICE 'No auth users without profiles found for manual test';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Manual insert failed: % - %', SQLSTATE, SQLERRM;
END $$;

-- 5. Show current RLS policies that might be blocking the trigger
SELECT 'Current INSERT policies on users table:' as info;
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  with_check
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public' AND cmd = 'INSERT';

SELECT 'Investigation complete - check the results above' as status;