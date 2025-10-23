/*
  # Refresh Users Table Schema

  1. Changes
    - Force schema refresh by recreating users table structure
    - Ensure all columns are properly recognized by PostgREST
    - Maintain all existing data and relationships

  2. Security
    - Preserve all existing RLS policies
    - Maintain proper authentication checks
*/

-- Force schema refresh by adding a comment to trigger cache reload
COMMENT ON TABLE public.users IS 'User profiles table - refreshed schema cache';

-- Ensure all columns exist with proper types
DO $$
BEGIN
  -- Check and add name column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'name'
  ) THEN
    ALTER TABLE public.users ADD COLUMN name text NOT NULL DEFAULT 'User';
  END IF;

  -- Check and add email column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.users ADD COLUMN email text UNIQUE NOT NULL;
  END IF;

  -- Check and add role column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE public.users ADD COLUMN role user_role NOT NULL DEFAULT 'trucker';
  END IF;

  -- Check and add location column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'location'
  ) THEN
    ALTER TABLE public.users ADD COLUMN location text NOT NULL DEFAULT '';
  END IF;

  -- Check and add phone column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.users ADD COLUMN phone text;
  END IF;

  -- Check and add truck_type column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'truck_type'
  ) THEN
    ALTER TABLE public.users ADD COLUMN truck_type text;
  END IF;

  -- Check and add license_number column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'license_number'
  ) THEN
    ALTER TABLE public.users ADD COLUMN license_number text;
  END IF;

  -- Check and add services column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'services'
  ) THEN
    ALTER TABLE public.users ADD COLUMN services text[];
  END IF;

  -- Check and add service_radius column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'service_radius'
  ) THEN
    ALTER TABLE public.users ADD COLUMN service_radius integer;
  END IF;

  -- Check and add certifications column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'certifications'
  ) THEN
    ALTER TABLE public.users ADD COLUMN certifications text[];
  END IF;

  -- Check and add language column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'language'
  ) THEN
    ALTER TABLE public.users ADD COLUMN language text DEFAULT 'en';
  END IF;

  -- Check and add rating column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'rating'
  ) THEN
    ALTER TABLE public.users ADD COLUMN rating numeric DEFAULT 0;
  END IF;

  -- Check and add join_date column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'join_date'
  ) THEN
    ALTER TABLE public.users ADD COLUMN join_date date DEFAULT CURRENT_DATE;
  END IF;

  -- Check and add created_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;

  -- Check and add updated_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Force PostgREST to reload schema by updating table comment
COMMENT ON TABLE public.users IS 'User profiles with all required columns - schema refreshed';

-- Refresh materialized views if any exist
-- This helps ensure PostgREST recognizes all changes
DO $$
BEGIN
  -- Refresh any materialized views that might depend on users table
  -- (Currently none, but this is good practice)
  NULL;
END $$;

-- Grant permissions to ensure proper access
GRANT ALL ON public.users TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Add helpful comments to key columns
COMMENT ON COLUMN public.users.name IS 'Full name of the user';
COMMENT ON COLUMN public.users.email IS 'User email address';
COMMENT ON COLUMN public.users.role IS 'User role: trucker or provider';
COMMENT ON COLUMN public.users.location IS 'User location';