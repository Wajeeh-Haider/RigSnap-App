/*
  # Fix User Profile Creation Array Handling

  1. Problem
    - The handle_new_user function incorrectly parses array data from raw_user_meta_data
    - This causes silent failures during user profile creation
    - Results in PGRST116 errors when trying to fetch non-existent user profiles

  2. Solution
    - Fix array parsing for services and certifications fields
    - Use proper JSONB array handling functions
    - Ensure user profiles are created successfully during signup

  3. Changes
    - Update handle_new_user function with correct array parsing
    - Add better error handling and logging
    - Ensure all user profiles are created properly
*/

-- Drop existing function and trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create improved user creation function with proper array handling
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
BEGIN
  -- Extract data from metadata with proper defaults
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', 'User');
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'trucker')::user_role;
  user_location := COALESCE(NEW.raw_user_meta_data->>'location', '');
  user_phone := NEW.raw_user_meta_data->>'phone';
  user_language := COALESCE(NEW.raw_user_meta_data->>'language', 'en');
  user_truck_type := NEW.raw_user_meta_data->>'truckType';
  user_license_number := NEW.raw_user_meta_data->>'licenseNumber';
  user_service_radius := COALESCE((NEW.raw_user_meta_data->>'serviceRadius')::integer, 25);

  -- Handle services array: Correctly parse JSON array from raw_user_meta_data
  IF NEW.raw_user_meta_data->'services' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'services') = 'array' THEN
    user_services := ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'services'));
  ELSE
    user_services := NULL; -- Ensure it's explicitly NULL if not an array or not present
  END IF;

  -- Handle certifications array: Correctly parse JSON array from raw_user_meta_data
  IF NEW.raw_user_meta_data->'certifications' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'certifications') = 'array' THEN
    user_certifications := ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'certifications'));
  ELSE
    user_certifications := NULL; -- Ensure it's explicitly NULL if not an array or not present
  END IF;

  -- Insert user profile with all available data
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
  
  -- Log successful user creation
  RAISE NOTICE 'Successfully created user profile for %', NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error with more detail
    RAISE WARNING 'Failed to create user profile for % (email: %): % - %', NEW.id, NEW.email, SQLSTATE, SQLERRM;
    
    -- Try to create a minimal user profile as fallback
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
        '',
        'en',
        0,
        CURRENT_DATE,
        now(),
        now()
      );
      RAISE NOTICE 'Created fallback user profile for %', NEW.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create even fallback user profile for %: % - %', NEW.id, SQLSTATE, SQLERRM;
    END;
    
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Clean up any existing users that might not have been created properly
-- and recreate them with proper data
DO $$
DECLARE
  auth_user RECORD;
  user_exists boolean;
BEGIN
  -- Check for auth users without corresponding public.users entries
  FOR auth_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
  LOOP
    RAISE NOTICE 'Found auth user without profile: % (%)', auth_user.id, auth_user.email;
    
    -- Create missing user profile
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
      CURRENT_DATE,
      now(),
      now()
    );
    
    RAISE NOTICE 'Created missing user profile for %', auth_user.id;
  END LOOP;
END $$;