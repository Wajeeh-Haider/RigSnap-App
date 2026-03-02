-- Enable RLS on tables that have policies but RLS not enabled
-- This fixes security linter errors for payment_methods and requests
-- Note: spatial_ref_sys is a PostGIS system table and cannot be modified

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;