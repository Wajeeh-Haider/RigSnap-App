-- Comprehensive Trigger Diagnostic and Fix Script
-- Run this in your Supabase SQL Editor to diagnose and fix the user creation trigger

-- 1. Check if the trigger exists
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 2. Check if the function exists
SELECT 
    routine_name, 
    routine_type, 
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 3. Drop existing trigger and function to ensure clean state
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- 4. Recreate the function with proper name construction
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
  -- Construct name from firstName and lastName, fallback to single name field or default
  user_name := COALESCE(
    NULLIF(TRIM(CONCAT(
      COALESCE(NEW.raw_user_meta_data->>'firstName', ''),
      ' ',
      COALESCE(NEW.raw_user_meta_data->>'lastName', '')
    )), ''),
    NEW.raw_user_meta_data->>'name',
    'User'
  );
  
  user_location := COALESCE(NEW.raw_user_meta_data->>'location', '');
  user_phone := NEW.raw_user_meta_data->>'phone';
  user_language := COALESCE(NEW.raw_user_meta_data->>'language', 'en');
  user_truck_type := NEW.raw_user_meta_data->>'truckType';
  user_license_number := NEW.raw_user_meta_data->>'licenseNumber';
  
  -- Extract service radius safely
  BEGIN
    user_service_radius := (NEW.raw_user_meta_data->>'serviceRadius')::integer;
  EXCEPTION
    WHEN OTHERS THEN
      user_service_radius := 25; -- Default radius
  END;
  
  -- Extract and validate role
  BEGIN
    user_role := (NEW.raw_user_meta_data->>'role')::user_role;
  EXCEPTION
    WHEN OTHERS THEN
      user_role := 'trucker'::user_role; -- Default role
  END;
  
  -- Extract services array safely
  BEGIN
    metadata_services := NEW.raw_user_meta_data->'services';
    IF metadata_services IS NOT NULL AND jsonb_typeof(metadata_services) = 'array' THEN
      SELECT array_agg(value::text) INTO user_services
      FROM jsonb_array_elements_text(metadata_services);
    ELSE
      user_services := CASE 
        WHEN user_role = 'provider' THEN ARRAY['repair']
        ELSE NULL
      END;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      user_services := CASE 
        WHEN user_role = 'provider' THEN ARRAY['repair']
        ELSE NULL
      END;
  END;
  
  -- Extract certifications array safely
  BEGIN
    metadata_certs := NEW.raw_user_meta_data->'certifications';
    IF metadata_certs IS NOT NULL AND jsonb_typeof(metadata_certs) = 'array' THEN
      SELECT array_agg(value::text) INTO user_certifications
      FROM jsonb_array_elements_text(metadata_certs);
    ELSE
      user_certifications := CASE 
        WHEN user_role = 'provider' THEN ARRAY['Basic Certification']
        ELSE NULL
      END;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      user_certifications := CASE 
        WHEN user_role = 'provider' THEN ARRAY['Basic Certification']
        ELSE NULL
      END;
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
      language,
      truck_type,
      license_number,
      services,
      service_radius,
      certifications,
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
      user_language,
      user_truck_type,
      user_license_number,
      user_services,
      user_service_radius,
      user_certifications,
      0,
      CURRENT_DATE,
      now(),
      now()
    );
    
    RAISE NOTICE 'Successfully created user profile for %', NEW.id;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- If main insertion fails, try minimal fallback
      RAISE WARNING 'Main user creation failed for %, attempting fallback: % - %', NEW.id, SQLSTATE, SQLERRM;
      
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
          RAISE EXCEPTION 'Complete failure to create user profile for %: % - %', NEW.id, SQLSTATE, SQLERRM;
      END;
  END;
  
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- 5. Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 6. Verify the trigger was created
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 7. Test the function exists
SELECT 
    routine_name, 
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- Success message
SELECT 'Trigger diagnostic and fix completed successfully!' as status;