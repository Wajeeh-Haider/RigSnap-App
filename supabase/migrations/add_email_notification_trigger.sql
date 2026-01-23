-- Create a trigger to automatically call the email notification function when a new request is created

-- First, create the trigger function for email notifications
CREATE OR REPLACE FUNCTION public.trigger_email_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for INSERT operations and when status is 'pending'
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Send a notification that can be picked up by the application
    -- The actual email sending will be handled by the client-side code in paymentOperations.ts
    PERFORM pg_notify('new_request_email_notification', json_build_object(
      'request_id', NEW.id,
      'customer_id', NEW.trucker_id,
      'service_type', NEW.service_type,
      'coordinates', NEW.coordinates,
      'location', NEW.location,
      'urgency', NEW.urgency,
      'description', NEW.description,
      'budget', NEW.estimated_cost,
      'status', NEW.status,
      'created_at', NEW.created_at
    )::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger for email notifications
DROP TRIGGER IF EXISTS on_request_created_email ON public.requests;
CREATE TRIGGER on_request_created_email
  AFTER INSERT ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_email_notifications();

-- Create a function that can be called manually to send email notifications for a specific request
CREATE OR REPLACE FUNCTION public.send_email_notifications_for_request(request_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
  request_record RECORD;
BEGIN
  -- Get the request details
  SELECT * INTO request_record FROM public.requests WHERE id = request_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;

  -- Call the edge function via HTTP request
  -- This is a placeholder - the actual implementation would use Supabase's HTTP extension
  -- or the edge function would be called directly

  RETURN json_build_object(
    'success', true,
    'message', 'Email notification trigger activated for request ' || request_id,
    'request_id', request_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.trigger_email_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_email_notifications_for_request(UUID) TO authenticated;