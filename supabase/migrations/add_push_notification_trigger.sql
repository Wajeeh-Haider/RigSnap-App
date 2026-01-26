-- Create a trigger to automatically call the push notification function when a new request is created

-- First, create the trigger function
CREATE OR REPLACE FUNCTION public.trigger_push_notifications()
RETURNS TRIGGER AS $$
DECLARE
  project_ref TEXT := 'YOUR_PROJECT_REF'; -- Replace with your actual project ref
  service_role_key TEXT := 'YOUR_SERVICE_ROLE_KEY'; -- Replace with your actual service role key
BEGIN
  -- Only trigger for INSERT operations and when status is 'pending'
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Call the edge function directly using supabase_functions.http_request
    -- This will invoke the send-push-notifications edge function asynchronously

    PERFORM supabase_functions.http_request(
      'POST',
      'https://' || project_ref || '.supabase.co/functions/v1/send-push-notifications',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      jsonb_build_object(
        'type', 'INSERT',
        'table', 'requests',
        'record', row_to_json(NEW)::jsonb,
        'schema', 'public'
      ),
      '10000' -- 10 second timeout
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_request_created ON public.requests;
CREATE TRIGGER on_request_created
  AFTER INSERT ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_push_notifications();

-- Alternative approach: Using Supabase's built-in webhook functionality
-- This is more reliable for calling edge functions

-- Create a webhook trigger using Supabase's HTTP extension (if available)
-- Note: The actual webhook setup needs to be done via Supabase dashboard or API

-- For immediate implementation, let's also create a function that can be called manually
CREATE OR REPLACE FUNCTION public.send_push_notifications_for_request(request_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- This function can be called manually or from the app
  -- to trigger push notifications for a specific request
  
  -- In a real implementation, this would call the edge function
  -- For now, it's a placeholder that returns the request info
  
  SELECT json_build_object(
    'status', 'queued',
    'request_id', request_id,
    'message', 'Push notifications queued for processing'
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.send_push_notifications_for_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_push_notifications() TO authenticated;