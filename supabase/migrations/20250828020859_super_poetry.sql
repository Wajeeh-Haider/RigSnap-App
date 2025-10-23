/*
  # Fix User Profile Creation - PGRST116 Error Resolution

  1. Problem
    - Users are not being created in the public.users table during signup
    - This causes PGRST116 "JSON object requested, multiple (or no) rows returned" error
    - The handle_new_user function is failing silently

  2. Solution
    - Completely rewrite the user creation function with robust error handling
    - Use simpler, more reliable metadata parsing
    - Add comprehensive logging to track issues
    - Ensure user profiles are always created

  3. Changes
    - Drop and recreate handle_new_user function with better logic
    - Add manual user creation for any missing profiles
    - Improve error handling and fallback mechanisms
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create a robust user creation function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name text;
  user_role user_role;
  user_location text;
  user_phone text;
  user_language text;
  user_truck_type text;
  user_license_number text;
  user_services text[];
  user_service_radius integer;
  user_certifications text[];
  metadata_services jsonb;
  metadata_certs jsonb;
BEGIN
  -- Log the start of user creation
  RAISE NOTICE 'Creating user profile for % with email %', NEW.id, NEW.email;
  
  -- Extract basic data with safe defaults
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', 'User');
  user_location := COALESCE(NEW.raw_user_meta_data->>'location', '');
  user_phone := NEW.raw_user_meta_data->>'phone';
  user_language := COALESCE(NEW.raw_user_meta_data->>'language', 'en');
  user_truck_type := NEW.raw_user_meta_data->>'truckType';
  user_license_number := NEW.raw_user_meta_data->>'licenseNumber';
  user_service_radius := COALESCE((NEW.raw_user_meta_data->>'serviceRadius')::integer, 25);

  -- Handle role with validation
  BEGIN
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'trucker')::user_role;
  EXCEPTION
    WHEN OTHERS THEN
      user_role := 'trucker'::user_role;
      RAISE WARNING 'Invalid role in metadata, defaulting to trucker for user %', NEW.id;
  END;

  -- Handle services array safely
  user_services := NULL;
  BEGIN
    metadata_services := NEW.raw_user_meta_data->'services';
    IF metadata_services IS NOT NULL AND jsonb_typeof(metadata_services) = 'array' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(metadata_services)) INTO user_services;
      RAISE NOTICE 'Parsed services array: %', user_services;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      user_services := NULL;
      RAISE WARNING 'Failed to parse services array for user %, setting to NULL', NEW.id;
  END;

  -- Handle certifications array safely
  user_certifications := NULL;
  BEGIN
    metadata_certs := NEW.raw_user_meta_data->'certifications';
    IF metadata_certs IS NOT NULL AND jsonb_typeof(metadata_certs) = 'array' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(metadata_certs)) INTO user_certifications;
      RAISE NOTICE 'Parsed certifications array: %', user_certifications;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      user_certifications := NULL;
      RAISE WARNING 'Failed to parse certifications array for user %, setting to NULL', NEW.id;
  END;

  -- Insert user profile with comprehensive error handling
  BEGIN
    INSERT INTO public.users (
      id,
      email,
      name,
      role,
      location,
      phone,
      truck_type,
      license_number,
      services,
      service_radius,
      certifications,
      language,
      rating,
      join_date,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.email,
      user_name,
      user_role,
      user_location,
      user_phone,
      user_truck_type,
      user_license_number,
      user_services,
      user_service_radius,
      user_certifications,
      user_language,
      0,
      CURRENT_DATE,
      now(),
      now()
    );
    
    RAISE NOTICE 'Successfully created user profile for % (%)', NEW.id, NEW.email;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Primary user creation failed for % (%): % - %', NEW.id, NEW.email, SQLSTATE, SQLERRM;
      
      -- Try minimal user creation as absolute fallback
      BEGIN
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
          NEW.id,
          NEW.email,
          user_name,
          'trucker'::user_role,
          COALESCE(user_location, ''),
          'en',
          0,
          CURRENT_DATE,
          now(),
          now()
        );
        
        RAISE NOTICE 'Created minimal fallback user profile for %', NEW.id;
        
      EXCEPTION
        WHEN OTHERS THEN
          RAISE ERROR 'Complete failure to create user profile for %: % - %', NEW.id, SQLSTATE, SQLERRM;
      END;
  END;
  
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Clean up any auth users that don't have corresponding public.users entries
DO $$
DECLARE
  auth_user RECORD;
  user_count integer;
BEGIN
  RAISE NOTICE 'Starting cleanup of missing user profiles...';
  
  -- Find auth users without public.users entries
  FOR auth_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data, au.created_at
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
  LOOP
    RAISE NOTICE 'Found auth user without profile: % (%)', auth_user.id, auth_user.email;
    
    -- Create missing user profile with minimal required data
    BEGIN
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
        auth_user.id,
        auth_user.email,
        COALESCE(auth_user.raw_user_meta_data->>'name', 'User'),
        COALESCE(auth_user.raw_user_meta_data->>'role', 'trucker')::user_role,
        COALESCE(auth_user.raw_user_meta_data->>'location', ''),
        COALESCE(auth_user.raw_user_meta_data->>'language', 'en'),
        0,
        COALESCE(auth_user.created_at::date, CURRENT_DATE),
        COALESCE(auth_user.created_at, now()),
        now()
      );
      
      RAISE NOTICE 'Successfully created missing user profile for %', auth_user.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create missing user profile for %: % - %', auth_user.id, SQLSTATE, SQLERRM;
    END;
  END LOOP;
  
  -- Count total users after cleanup
  SELECT COUNT(*) INTO user_count FROM public.users;
  RAISE NOTICE 'Cleanup complete. Total users in database: %', user_count;
END $$;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';

-- Add table comment to force PostgREST schema reload
COMMENT ON TABLE public.users IS 'User profiles table - schema refreshed to fix PGRST116 errors';