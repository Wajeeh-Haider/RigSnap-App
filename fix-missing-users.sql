-- Fix missing user profiles
-- Run this in your Supabase SQL editor to create missing user profiles

-- Insert missing user profiles based on auth.users data
INSERT INTO public.users (
  id,
  email,
  name,
  role,
  location,
  phone,
  language,
  rating,
  join_date,
  created_at,
  updated_at
)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'name',
    au.raw_user_meta_data->>'firstName',
    SPLIT_PART(au.email, '@', 1) -- Use email username as fallback name
  ) as name,
  COALESCE(
    (au.raw_user_meta_data->>'role')::user_role,
    'trucker'::user_role
  ) as role,
  COALESCE(
    au.raw_user_meta_data->>'location',
    'Not specified'
  ) as location,
  au.raw_user_meta_data->>'phone' as phone,
  COALESCE(
    au.raw_user_meta_data->>'language',
    'en'
  ) as language,
  0 as rating,
  au.created_at::date as join_date,
  au.created_at,
  au.updated_at
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL;

-- Verify the insert worked
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  u.created_at
FROM public.users u
WHERE u.id IN (
  '2156c847-a868-4a66-9d58-05fa23f02c3f',
  'dd562155-2513-4976-b2d2-202af20d772f'
);