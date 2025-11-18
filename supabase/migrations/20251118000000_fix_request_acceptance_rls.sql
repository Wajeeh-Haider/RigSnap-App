-- Fix RLS policy for request acceptance
-- The issue is that providers can't update requests to accept them because provider_id is NULL when they try to accept

-- Drop the problematic policy
DROP POLICY IF EXISTS "Providers can update requests they're involved in" ON public.requests;

-- Create a new policy that allows providers to accept pending requests
CREATE POLICY "Providers can accept pending requests" ON public.requests
  FOR UPDATE USING (
    -- Allow if user is already the provider (for status updates)
    auth.uid() = provider_id 
    OR 
    -- Allow if request is pending and being accepted (provider_id being set)
    (status = 'pending' AND provider_id IS NULL)
  );

-- Also ensure truckers can still update their own requests
DROP POLICY IF EXISTS "Truckers can update their own requests" ON public.requests;
CREATE POLICY "Truckers can update their own requests" ON public.requests
  FOR UPDATE USING (auth.uid() = trucker_id);