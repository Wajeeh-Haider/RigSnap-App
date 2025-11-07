-- Debug RLS policies and permissions for user creation
-- Run this in Supabase SQL Editor

-- 1. Check if RLS is enabled on users table
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- 2. Check all policies on users table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

-- 3. Check table permissions
SELECT 
  grantee, 
  privilege_type, 
  is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'users' AND table_schema = 'public';

-- 4. Test if we can insert directly into users table (this should work for authenticated users)
-- First, let's see what the current auth context is
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role;

-- 5. Check if there are any constraints that might be failing
SELECT 
  constraint_name,
  constraint_type,
  table_name,
  column_name
FROM information_schema.constraint_column_usage 
WHERE table_name = 'users' AND table_schema = 'public';

-- 6. Check for any foreign key constraints
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'users'
  AND tc.table_schema = 'public';

-- 7. Test a simple insert to see what happens
-- (This will fail if there are permission issues)
DO $$
BEGIN
  -- Try to insert a test user to see what error we get
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
    gen_random_uuid(),
    'debug-test@example.com',
    'Debug Test User',
    'trucker',
    'Test Location',
    'en',
    0,
    CURRENT_DATE,
    now(),
    now()
  );
  
  RAISE NOTICE 'Test insert successful - no permission issues';
  
  -- Clean up the test user
  DELETE FROM public.users WHERE email = 'debug-test@example.com';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Test insert failed: % - %', SQLSTATE, SQLERRM;
END $$;

-- 8. Check if the handle_new_user function has the right permissions
SELECT 
  routine_name,
  routine_type,
  security_type,
  definer_rights
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';