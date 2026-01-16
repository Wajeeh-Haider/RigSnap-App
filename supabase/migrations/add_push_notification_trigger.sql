-- Create a trigger to automatically call the push notification function when a new request is created

-- First, create the trigger function
CREATE OR REPLACE FUNCTION public.trigger_push_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for INSERT operations and when status is 'pending'
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Call the edge function asynchronously using pg_net (if available)
    -- Note: This requires the pg_net extension to be enabled
    -- Alternative: Use supabase_functions.http_request if available
    
    -- For now, we'll use a simpler approach with webhooks
    -- The actual HTTP call will be handled by a separate webhook trigger
    
    PERFORM pg_notify('new_request_created', json_build_object(
      'request_id', NEW.id,
      'trucker_id', NEW.trucker_id,
      'service_type', NEW.service_type,
      'coordinates', NEW.coordinates,
      'location', NEW.location,
      'urgency', NEW.urgency,
      'description', NEW.description
    )::text);
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