-- Enable PostGIS extension for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography columns to users table for spatial indexing
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS location_geography geography(POINT, 4326);

-- Add geography columns to requests table for spatial indexing
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS coordinates_geography geography(POINT, 4326);

-- Create index on users location for faster spatial queries
CREATE INDEX IF NOT EXISTS idx_users_location_geography ON public.users USING GIST (location_geography);

-- Create index on requests coordinates for faster spatial queries
CREATE INDEX IF NOT EXISTS idx_requests_coordinates_geography ON public.requests USING GIST (coordinates_geography);

-- Function to find nearby requests using PostGIS
-- This replaces local filtering for providers browsing requests
DROP FUNCTION IF EXISTS public.nearby_requests(double precision, double precision, double precision, text[]);
CREATE OR REPLACE FUNCTION public.nearby_requests(
  lat DOUBLE PRECISION,
  long DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION,
  provider_services TEXT[] DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  trucker_id UUID,
  trucker_name TEXT,
  trucker_phone TEXT,
  service_type TEXT,
  description TEXT,
  location TEXT,
  coordinates JSONB,
  status TEXT,
  urgency TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  estimated_cost NUMERIC,
  actual_cost NUMERIC,
  photos TEXT[],
  distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.trucker_id,
    u.name as trucker_name,
    u.phone as trucker_phone,
    r.service_type::TEXT as service_type,
    r.description,
    r.location,
    r.coordinates,
    r.status::TEXT as status,
    r.urgency::TEXT as urgency,
    r.created_at,
    r.estimated_cost,
    r.actual_cost,
    r.photos,
    ST_Distance(
      r.coordinates_geography,
      ST_SetSRID(ST_MakePoint(long, lat), 4326)
    )::DOUBLE PRECISION as distance_meters
  FROM public.requests r
  JOIN public.users u ON r.trucker_id = u.id
  WHERE
    r.status = 'pending'
    AND r.provider_id IS NULL
    AND r.coordinates_geography IS NOT NULL
    AND ST_DWithin(
      r.coordinates_geography,
      ST_SetSRID(ST_MakePoint(long, lat), 4326),
      radius_meters
    )
    AND (provider_services IS NULL OR array_length(provider_services, 1) IS NULL OR r.service_type::TEXT = ANY(provider_services))
  ORDER BY distance_meters;
END;
$$;

-- Function to find nearby locations using PostGIS
-- This replaces the need for local filtering
DROP FUNCTION IF EXISTS public.nearby_locations(double precision, double precision, double precision);
CREATE OR REPLACE FUNCTION public.nearby_locations(
  lat DOUBLE PRECISION,
  long DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  location TEXT,
  role TEXT,
  services TEXT[],
  service_radius INTEGER,
  push_token TEXT,
  email TEXT,
  distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.location,
    u.role::TEXT as role,
    u.services,
    u.service_radius,
    u.push_token,
    u.email,
    ST_Distance(
      u.location_geography,
      ST_SetSRID(ST_MakePoint(long, lat), 4326)
    )::DOUBLE PRECISION as distance_meters
  FROM public.users u
  WHERE
    u.role = 'provider'
    AND u.location_geography IS NOT NULL
    AND ST_DWithin(
      u.location_geography,
      ST_SetSRID(ST_MakePoint(long, lat), 4326),
      radius_meters
    )
  ORDER BY distance_meters;
END;
$$;

-- Function to populate geography columns from existing text/json data
-- This should be run after enabling PostGIS
CREATE OR REPLACE FUNCTION public.populate_geography_columns()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  user_record RECORD;
  request_record RECORD;
BEGIN
  -- Populate users location_geography
  FOR user_record IN SELECT id, location FROM public.users WHERE location IS NOT NULL
  LOOP
    BEGIN
      -- Try to parse as JSON first
      IF user_record.location::text LIKE '{%' THEN
        -- JSON format: {"latitude": 31.5204, "longitude": 74.3587}
        UPDATE public.users
        SET location_geography = ST_SetSRID(
          ST_MakePoint(
            (user_record.location::jsonb->>'longitude')::DOUBLE PRECISION,
            (user_record.location::jsonb->>'latitude')::DOUBLE PRECISION
          ),
          4326
        )
        WHERE id = user_record.id;
      ELSE
        -- Try "lat,lng" format
        UPDATE public.users
        SET location_geography = ST_SetSRID(
          ST_MakePoint(
            split_part(user_record.location, ',', 2)::DOUBLE PRECISION,
            split_part(user_record.location, ',', 1)::DOUBLE PRECISION
          ),
          4326
        )
        WHERE id = user_record.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Skip invalid locations
      CONTINUE;
    END;
  END LOOP;

  -- Populate requests coordinates_geography
  FOR request_record IN SELECT id, coordinates FROM public.requests WHERE coordinates IS NOT NULL
  LOOP
    BEGIN
      UPDATE public.requests
      SET coordinates_geography = ST_SetSRID(
        ST_MakePoint(
          (request_record.coordinates->>'longitude')::DOUBLE PRECISION,
          (request_record.coordinates->>'latitude')::DOUBLE PRECISION
        ),
        4326
      )
      WHERE id = request_record.id;
    EXCEPTION WHEN OTHERS THEN
      -- Skip invalid coordinates
      CONTINUE;
    END;
  END LOOP;
END;
$$;

-- Call the function to populate geography columns
SELECT public.populate_geography_columns();

-- Drop the helper function after use
DROP FUNCTION public.populate_geography_columns();