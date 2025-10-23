/*
  # Create Users Table and Fix Schema Issues

  1. New Tables
    - Ensure `users` table exists with proper structure
    - Add all necessary columns and constraints
    - Set up proper relationships and indexes

  2. Security
    - Enable RLS on users table
    - Add comprehensive policies for user data access
    - Ensure proper authentication checks

  3. Functions
    - Create user profile creation function
    - Add trigger for automatic profile creation
    - Handle user metadata properly
*/

-- Create custom types if they don't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('trucker', 'provider');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE service_type AS ENUM ('towing', 'repair', 'mechanic', 'tire_repair', 'truck_wash', 'hose_repair');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_type AS ENUM ('text', 'location', 'image', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_status AS ENUM ('pending', 'charged', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role user_role NOT NULL,
  location text NOT NULL,
  phone text,
  truck_type text,
  license_number text,
  services text[],
  service_radius integer,
  certifications text[],
  language text DEFAULT 'en',
  rating numeric DEFAULT 0,
  join_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create other tables if they don't exist
CREATE TABLE IF NOT EXISTS public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trucker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  location text NOT NULL,
  coordinates jsonb NOT NULL,
  service_type service_type NOT NULL,
  status request_status DEFAULT 'pending',
  urgency urgency_level DEFAULT 'medium',
  description text NOT NULL,
  estimated_cost numeric,
  actual_cost numeric,
  photos text[],
  cancellation_reason text,
  cancelled_by user_role,
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type message_type DEFAULT 'text',
  is_read boolean DEFAULT false,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_role user_role NOT NULL,
  amount numeric NOT NULL,
  status lead_status DEFAULT 'pending',
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_requests_trucker_id ON public.requests(trucker_id);
CREATE INDEX IF NOT EXISTS idx_requests_provider_id ON public.requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_service_type ON public.requests(service_type);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON public.requests(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_request_id ON public.messages(request_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_request_id ON public.leads(request_id);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read requests they're involved in" ON public.requests;
DROP POLICY IF EXISTS "Truckers can create requests" ON public.requests;
DROP POLICY IF EXISTS "Users can update requests they're involved in" ON public.requests;
DROP POLICY IF EXISTS "Users can read messages for their requests" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages for their requests" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can read their own leads" ON public.leads;
DROP POLICY IF EXISTS "System can create leads" ON public.leads;

-- Users policies
CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Requests policies
CREATE POLICY "Users can read requests they're involved in"
  ON public.requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = trucker_id OR 
    auth.uid() = provider_id OR
    status = 'pending'
  );

CREATE POLICY "Truckers can create requests"
  ON public.requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = trucker_id);

CREATE POLICY "Users can update requests they're involved in"
  ON public.requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = trucker_id OR 
    auth.uid() = provider_id
  );

-- Messages policies
CREATE POLICY "Users can read messages for their requests"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests 
      WHERE public.requests.id = public.messages.request_id 
      AND (public.requests.trucker_id = auth.uid() OR public.requests.provider_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages for their requests"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.requests 
      WHERE public.requests.id = public.messages.request_id 
      AND (public.requests.trucker_id = auth.uid() OR public.requests.provider_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id);

-- Leads policies
CREATE POLICY "Users can read their own leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create leads"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Drop existing user creation function and trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Function to handle user creation
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

  -- Handle services array
  IF NEW.raw_user_meta_data->>'services' IS NOT NULL THEN
    user_services := string_to_array(NEW.raw_user_meta_data->>'services', ',');
  END IF;

  -- Handle certifications array
  IF NEW.raw_user_meta_data->>'certifications' IS NOT NULL THEN
    user_certifications := string_to_array(NEW.raw_user_meta_data->>'certifications', ',');
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
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth user creation
    RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.requests TO authenticated;
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.leads TO authenticated;