-- Check for requests with missing users
-- Run this in your Supabase SQL editor

-- Find requests with missing truckers
SELECT 
  r.id as request_id,
  r.trucker_id,
  r.description,
  r.created_at,
  u.name as user_exists
FROM requests r
LEFT JOIN users u ON r.trucker_id = u.id
WHERE u.id IS NULL;

-- Find requests with missing providers
SELECT 
  r.id as request_id,
  r.provider_id,
  r.description,
  r.created_at,
  u.name as provider_exists
FROM requests r
LEFT JOIN users u ON r.provider_id = u.id
WHERE r.provider_id IS NOT NULL AND u.id IS NULL;

-- Get all users from auth.users who don't have profiles
SELECT 
  au.id,
  au.email,
  au.created_at,
  u.name as profile_exists
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL;