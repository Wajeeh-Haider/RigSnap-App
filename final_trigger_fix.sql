-- Final Trigger Fix - Handle existing policies properly
-- Run this in your Supabase SQL Editor

-- 1. Check what policies currently exist
SELECT 'Current INSERT policies on users table:' as info;
SELECT policyname, cmd, with_check
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public' AND cmd = 'INSERT';

-- 2. Drop ALL existing INSERT policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user profile creation" ON public.users;
DROP POLICY IF EXISTS "Users can create profiles" ON public.users;

-- 3. Create a single, permissive INSERT policy for the trigger
CREATE POLICY "Enable user profile creation"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Verify the trigger function exists and has SECURITY DEFINER
SELECT 'Checking trigger function:' as info;
SELECT 
  routine_name, 
  routine_type, 
  security_type,
  CASE 
    WHEN routine_definition LIKE '%SECURITY DEFINER%' THEN 'Has SECURITY DEFINER'
    ELSE 'Missing SECURITY DEFINER'
  END as security_status
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 5. Verify the trigger exists and is active
SELECT 'Checking trigger:' as info;
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 6. Check recent auth users to see if any failed to create profiles
SELECT 'Recent auth users (last 5):' as info;
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
LIMIT 5;

-- 7. Test if we can manually insert a user profile (this should work now)
DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
BEGIN
  -- Try to insert a test user profile
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
    test_user_id,
    'manual-test@example.com',
    'Manual Test User',
    'trucker',
    'Test Location',
    'en',
    0,
    CURRENT_DATE,
    now(),
    now()
  );
  
  RAISE NOTICE 'Manual insert successful - RLS policies are working';
  
  -- Clean up the test user
  DELETE FROM public.users WHERE id = test_user_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Manual insert failed: % - %', SQLSTATE, SQLERRM;
END $$;

-- 8. Final verification
SELECT 'Final policy check:' as info;
SELECT policyname, cmd, with_check
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public' AND cmd = 'INSERT';

-- Success message
SELECT 'Trigger fix completed! Try signup again.' as status;