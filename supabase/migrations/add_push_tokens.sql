-- Add push notification token to users table
ALTER TABLE public.users 
ADD COLUMN push_token TEXT;

-- Create index for better performance when querying by push_token
CREATE INDEX IF NOT EXISTS idx_users_push_token ON public.users(push_token);

-- Create a function to calculate distance between two coordinates (if not exists)
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 FLOAT,
  lon1 FLOAT,
  lat2 FLOAT,
  lon2 FLOAT
) RETURNS FLOAT AS $$
DECLARE
  R FLOAT := 6371; -- Earth's radius in kilometers
  dLat FLOAT;
  dLon FLOAT;
  a FLOAT;
  c FLOAT;
BEGIN
  -- Convert degrees to radians
  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);
  
  -- Haversine formula
  a := sin(dLat/2) * sin(dLat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon/2) * sin(dLon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN R * c; -- Distance in kilometers
END;
$$ LANGUAGE plpgsql;