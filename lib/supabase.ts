import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://agweunkrewqoxsivkfwl.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnd2V1bmtyZXdxb3hzaXZrZndsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjQ4NjMsImV4cCI6MjA3NzYwMDg2M30.e6Ex0-z2PzTUhe7slniPKpOLySuYEo9y6HNfdmLDAig';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
