-- Comprehensive Trigger Fix Script
-- This script will diagnose and fix all issues with the user creation trigger

-- 1. Check current trigger and function status
SELECT 'DIAGNOSTIC: Current trigger status' as section;
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

SELECT 'DIAGNOSTIC: Current function status' as section;
SELECT 
  routine_name, 
  routine_type, 
  security_type,
  sql_data_access
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 2. Check current RLS policies
SELECT 'DIAGNOSTIC: Current INSERT policies' as section;
SELECT policyname, cmd, with_check, qual
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public' AND cmd = 'INSERT';

-- 3. Drop existing trigger and function to ensure clean state
SELECT 'FIXING: Dropping existing trigger and function' as section;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- 4. Drop conflicting INSERT policies
SELECT 'FIXING: Cleaning up INSERT policies' as section;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user profile creation" ON public.users;
DROP POLICY IF EXISTS "Users can create profiles" ON public.users;
DROP POLICY IF EXISTS "Enable user profile creation" ON public.users;

-- 5. Create a single, permissive INSERT policy
CREATE POLICY "trigger_user_creation"
  ON public.users
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- 6. Create the trigger function with SECURITY DEFINER and comprehensive error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- Log the start of user creation with detailed info
  RAISE NOTICE 'TRIGGER START: Creating user profile for % with email %, metadata: %', 
    NEW.id, NEW.email, NEW.raw_user_meta_data;
  
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
  
  -- Extract role safely
  BEGIN
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'trucker')::user_role;
  EXCEPTION
    WHEN OTHERS THEN
      user_role := 'trucker'::user_role;
      RAISE NOTICE 'TRIGGER: Using default role for user %', NEW.id;
  END;
  
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
  
  -- Extract services array safely
  BEGIN
    metadata_services := NEW.raw_user_meta_data->'services';
    IF metadata_services IS NOT NULL AND jsonb_typeof(metadata_services) = 'array' THEN
      SELECT array_agg(value::text) INTO user_services
      FROM jsonb_array_elements_text(metadata_services);
    ELSE
      user_services := ARRAY[]::text[];
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      user_services := ARRAY[]::text[];
      RAISE NOTICE 'TRIGGER: Error parsing services for user %, using empty array', NEW.id;
  END;
  
  -- Extract certifications array safely
  BEGIN
    metadata_certs := NEW.raw_user_meta_data->'certifications';
    IF metadata_certs IS NOT NULL AND jsonb_typeof(metadata_certs) = 'array' THEN
      SELECT array_agg(value::text) INTO user_certifications
      FROM jsonb_array_elements_text(metadata_certs);
    ELSE
      user_certifications := ARRAY[]::text[];
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      user_certifications := ARRAY[]::text[];
      RAISE NOTICE 'TRIGGER: Error parsing certifications for user %, using empty array', NEW.id;
  END;

  -- Log extracted data
  RAISE NOTICE 'TRIGGER: Extracted data - name: %, role: %, location: %', 
    user_name, user_role, user_location;

  -- Attempt to insert user profile with full data
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
    
    RAISE NOTICE 'TRIGGER SUCCESS: Created full user profile for %', NEW.id;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- If main insertion fails, try minimal fallback
      RAISE WARNING 'TRIGGER: Main user creation failed for %, attempting fallback: % - %', 
        NEW.id, SQLSTATE, SQLERRM;
      
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
        
        RAISE NOTICE 'TRIGGER SUCCESS: Created minimal fallback user profile for %', NEW.id;
        
      EXCEPTION
        WHEN OTHERS THEN
          RAISE EXCEPTION 'TRIGGER FAILURE: Complete failure to create user profile for %: % - %', 
            NEW.id, SQLSTATE, SQLERRM;
      END;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 8. Grant necessary permissions to the function
GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated, anon;

-- 9. Verify everything was created correctly
SELECT 'VERIFICATION: Trigger created' as section;
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

SELECT 'VERIFICATION: Function created' as section;
SELECT 
  routine_name, 
  routine_type, 
  security_type
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

SELECT 'VERIFICATION: INSERT policy created' as section;
SELECT policyname, cmd, with_check
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public' AND cmd = 'INSERT';

-- 10. Test the function with existing auth users who don't have profiles
DO $$
DECLARE
  auth_user RECORD;
  test_count integer := 0;
BEGIN
  RAISE NOTICE 'CLEANUP: Looking for auth users without profiles...';
  
  FOR auth_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data, au.created_at
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
    ORDER BY au.created_at DESC
    LIMIT 5  -- Limit to prevent overwhelming output
  LOOP
    test_count := test_count + 1;
    RAISE NOTICE 'CLEANUP: Found auth user without profile: % (%) - created: %', 
      auth_user.id, auth_user.email, auth_user.created_at;
    
    -- Manually create the missing profile using the same logic as the trigger
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
        COALESCE(
          NULLIF(TRIM(CONCAT(
            COALESCE(auth_user.raw_user_meta_data->>'firstName', ''),
            ' ',
            COALESCE(auth_user.raw_user_meta_data->>'lastName', '')
          )), ''),
          auth_user.raw_user_meta_data->>'name',
          'User'
        ),
        COALESCE(auth_user.raw_user_meta_data->>'role', 'trucker')::user_role,
        COALESCE(auth_user.raw_user_meta_data->>'location', ''),
        COALESCE(auth_user.raw_user_meta_data->>'language', 'en'),
        0,
        CURRENT_DATE,
        now(),
        now()
      );
      
      RAISE NOTICE 'CLEANUP SUCCESS: Created missing profile for %', auth_user.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'CLEANUP FAILED: Could not create profile for %: % - %', 
          auth_user.id, SQLSTATE, SQLERRM;
    END;
  END LOOP;
  
  IF test_count = 0 THEN
    RAISE NOTICE 'CLEANUP: No auth users without profiles found';
  ELSE
    RAISE NOTICE 'CLEANUP: Processed % auth users without profiles', test_count;
  END IF;
END $$;

-- 11. Final status check
SELECT 'FINAL STATUS: Users in auth.users vs public.users' as section;
SELECT 
  (SELECT COUNT(*) FROM auth.users) as auth_users_count,
  (SELECT COUNT(*) FROM public.users) as public_users_count,
  (SELECT COUNT(*) FROM auth.users au LEFT JOIN public.users pu ON au.id = pu.id WHERE pu.id IS NULL) as missing_profiles_count;

SELECT 'SUCCESS: Comprehensive trigger fix completed!' as result;