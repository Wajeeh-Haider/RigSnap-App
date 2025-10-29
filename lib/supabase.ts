import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ffahtljretkbgrgbolct.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmYWh0bGpyZXRrYmdyZ2JvbGN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNjg0NzYsImV4cCI6MjA3NjY0NDQ3Nn0.vhcBj83EojXG7hqk585ahPOXeAwSG6TEj5uupu5Sk5g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
