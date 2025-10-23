/*
  # Initial RigSnap Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique)
      - `name` (text)
      - `role` (enum: trucker, provider)
      - `location` (text)
      - `phone` (text, nullable)
      - `truck_type` (text, nullable - for truckers)
      - `license_number` (text, nullable - for truckers)
      - `services` (text array, nullable - for providers)
      - `service_radius` (integer, nullable - for providers)
      - `certifications` (text array, nullable - for providers)
      - `language` (text, default 'en')
      - `rating` (numeric, default 0)
      - `join_date` (date, default today)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `requests`
      - `id` (uuid, primary key)
      - `trucker_id` (uuid, references users)
      - `provider_id` (uuid, nullable, references users)
      - `location` (text)
      - `coordinates` (jsonb)
      - `service_type` (enum)
      - `status` (enum, default 'pending')
      - `urgency` (enum, default 'medium')
      - `description` (text)
      - `estimated_cost` (numeric, nullable)
      - `actual_cost` (numeric, nullable)
      - `photos` (text array, nullable)
      - `cancellation_reason` (text, nullable)
      - `cancelled_by` (enum, nullable)
      - `created_at` (timestamp)
      - `accepted_at` (timestamp, nullable)
      - `completed_at` (timestamp, nullable)
      - `cancelled_at` (timestamp, nullable)

    - `messages`
      - `id` (uuid, primary key)
      - `request_id` (uuid, references requests)
      - `sender_id` (uuid, references users)
      - `content` (text)
      - `message_type` (enum, default 'text')
      - `is_read` (boolean, default false)
      - `timestamp` (timestamp, default now)
      - `created_at` (timestamp)

    - `leads`
      - `id` (uuid, primary key)
      - `request_id` (uuid, references requests)
      - `user_id` (uuid, references users)
      - `user_role` (enum)
      - `amount` (numeric)
      - `status` (enum, default 'pending')
      - `description` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Add policies for request and message access based on participation
*/

-- Create custom types
CREATE TYPE user_role AS ENUM ('trucker', 'provider');
CREATE TYPE service_type AS ENUM ('towing', 'repair', 'mechanic', 'tire_repair', 'truck_wash', 'hose_repair');
CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');
CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE message_type AS ENUM ('text', 'location', 'image', 'system');
CREATE TYPE lead_status AS ENUM ('pending', 'charged', 'refunded');

-- Create users table
CREATE TABLE IF NOT EXISTS users (
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

-- Create requests table
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trucker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES users(id) ON DELETE SET NULL,
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

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type message_type DEFAULT 'text',
  is_read boolean DEFAULT false,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_role user_role NOT NULL,
  amount numeric NOT NULL,
  status lead_status DEFAULT 'pending',
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_requests_trucker_id ON requests(trucker_id);
CREATE INDEX IF NOT EXISTS idx_requests_provider_id ON requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_service_type ON requests(service_type);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_request_id ON messages(request_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_request_id ON leads(request_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Requests policies
CREATE POLICY "Users can read requests they're involved in"
  ON requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = trucker_id OR 
    auth.uid() = provider_id OR
    status = 'pending'
  );

CREATE POLICY "Truckers can create requests"
  ON requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = trucker_id);

CREATE POLICY "Users can update requests they're involved in"
  ON requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = trucker_id OR 
    auth.uid() = provider_id
  );

-- Messages policies
CREATE POLICY "Users can read messages for their requests"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests 
      WHERE requests.id = messages.request_id 
      AND (requests.trucker_id = auth.uid() OR requests.provider_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages for their requests"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM requests 
      WHERE requests.id = messages.request_id 
      AND (requests.trucker_id = auth.uid() OR requests.provider_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own messages"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id);

-- Leads policies
CREATE POLICY "Users can read their own leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create leads"
  ON leads
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
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, location)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'trucker')::user_role,
    COALESCE(NEW.raw_user_meta_data->>'location', '')
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger for new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();