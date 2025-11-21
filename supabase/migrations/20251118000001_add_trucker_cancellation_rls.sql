-- Add RLS policy for truckers to cancel their own pending requests
-- This policy allows truckers to update their own requests when they are pending
CREATE POLICY "Truckers can cancel their own pending requests" ON public.requests
  FOR UPDATE USING (
    auth.uid() = trucker_id AND 
    status = 'pending'
  );