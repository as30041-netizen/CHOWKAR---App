-- FIX: Exclude jobs that user has already bid on from Discover/Home feed
-- First drop ALL versions of get_home_feed to avoid signature conflicts

-- Drop all possible signatures
DROP FUNCTION IF EXISTS get_home_feed(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(uuid, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(uuid, integer, integer, boolean) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(uuid, integer, integer, text) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(uuid, integer, integer, text, boolean) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(text) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(text, integer, integer) CASCADE;

-- Now create the fixed version
CREATE OR REPLACE FUNCTION get_home_feed(
  p_user_id UUID,
  p_limit INTEGER,
  p_offset INTEGER
)
RETURNS TABLE (
  id UUID,
  poster_id UUID,
  poster_name TEXT,
  poster_phone TEXT,
  poster_photo TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  job_date DATE,
  duration TEXT,
  budget INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ,
  image TEXT,
  bid_count BIGINT,
  accepted_bid_id UUID,
  my_bid_id UUID,
  my_bid_status TEXT,
  my_bid_amount INTEGER,
  my_bid_last_negotiation_by TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.poster_id,
    j.poster_name,
    j.poster_phone,
    j.poster_photo,
    j.title,
    j.description,
    j.category,
    j.location,
    j.latitude::DOUBLE PRECISION,
    j.longitude::DOUBLE PRECISION,
    j.job_date,
    j.duration,
    j.budget,
    j.status,
    j.created_at,
    j.image,
    (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id)::BIGINT as bid_count,
    j.accepted_bid_id,
    NULL::UUID as my_bid_id,
    NULL::TEXT as my_bid_status,
    NULL::INTEGER as my_bid_amount,
    NULL::TEXT as my_bid_last_negotiation_by
  FROM jobs j
  WHERE j.status = 'OPEN'
  AND (p_user_id IS NULL OR j.poster_id != p_user_id)
  AND NOT EXISTS (
    SELECT 1 FROM bids b 
    WHERE b.job_id = j.id 
    AND b.worker_id = p_user_id
  )
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_home_feed(uuid, integer, integer) TO authenticated, anon, service_role;

SELECT 'SUCCESS: get_home_feed now excludes jobs with existing bids' as result;
