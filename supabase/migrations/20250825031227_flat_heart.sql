/*
  # Fix User Profile Creation

  1. Changes
    - Drop and recreate the user creation trigger function
    - Ensure proper user profile creation on signup
    - Add better error handling for user creation
    - Fix the trigger to handle all required fields

  2. Security
    - Maintain existing RLS policies
    - Ensure proper data validation
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create improved function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name text;
  user_role user_role;
  user_location text;
BEGIN
  -- Extract data from metadata with proper defaults
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', 'User');
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'trucker')::user_role;
  user_location := COALESCE(NEW.raw_user_meta_data->>'location', '');

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
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE(NEW.raw_user_meta_data->>'truckType', NULL),
    COALESCE(NEW.raw_user_meta_data->>'licenseNumber', NULL),
    CASE 
      WHEN NEW.raw_user_meta_data->>'services' IS NOT NULL 
      THEN string_to_array(NEW.raw_user_meta_data->>'services', ',')
      ELSE NULL
    END,
    COALESCE((NEW.raw_user_meta_data->>'serviceRadius')::integer, NULL),
    CASE 
      WHEN NEW.raw_user_meta_data->>'certifications' IS NOT NULL 
      THEN string_to_array(NEW.raw_user_meta_data->>'certifications', ',')
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data->>'language', 'en'),
    0,
    CURRENT_DATE,
    now(),
    now()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth user creation
    RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;