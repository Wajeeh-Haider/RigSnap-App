import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xspatucajczcbdzyfioi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcGF0dWNhamN6Y2JkenlmaW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNjgyNzcsImV4cCI6MjA2Nzk0NDI3N30.kIHULuWajOXBL-Uk7QFSyG_wMVlRAuC8AZ4CmtCBNQk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});