-- FINAL PERMISSIONS AND RPC FIX (COMPLETE)
-- This script fixes the "jobs not loading" issue by:
-- 1. Granting Execute permissions (The most likely culprit)
-- 2. Casting DATE to TEXT to avoid JSON parsing issues
-- 3. Providing fallback names to avoid NULL issues

BEGIN;

-- 1. DROP AND RE-GRANT (To be safe)
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS get_my_applications_feed(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INTEGER, INTEGER) CASCADE;

-- 2. Accurate Home Feed (Discovery)
CREATE OR REPLACE FUNCTION get_home_feed(
  p_user_id UUID,
  p_limit INTEGER,
  p_offset INTEGER,
  p_exclude_completed BOOLEAN DEFAULT FALSE
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
  job_date TEXT,
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
    COALESCE(j.poster_name, 'Poster'),
    COALESCE(j.poster_phone, ''),
    j.poster_photo,
    j.title,
    j.description,
    j.category,
    j.location,
    j.latitude::DOUBLE PRECISION,
    j.longitude::DOUBLE PRECISION,
    j.job_date::TEXT,
    j.duration,
    j.budget,
    j.status,
    j.created_at,
    j.image,
    (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id)::BIGINT as bid_count,
    j.accepted_bid_id,
    b.id as my_bid_id,
    b.status as my_bid_status,
    b.amount as my_bid_amount,
    (b.negotiation_history -> -1 ->> 'by') as my_bid_last_negotiation_by
  FROM jobs j
  LEFT JOIN bids b ON b.job_id = j.id AND b.worker_id = p_user_id
  WHERE 
    (j.status = 'OPEN')
    AND (p_user_id IS NULL OR j.poster_id != p_user_id)
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 3. Accurate Applications Feed (Worker History)
CREATE OR REPLACE FUNCTION get_my_applications_feed(
  p_user_id UUID,
  p_limit INTEGER,
  p_offset INTEGER
)
RETURNS TABLE (
  id UUID,
  poster_id UUID,
  poster_name TEXT,
  poster_photo TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  job_date TEXT,
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
    COALESCE(j.poster_name, 'Poster'),
    j.poster_photo,
    j.title,
    j.description,
    j.category,
    j.location,
    j.latitude::DOUBLE PRECISION,
    j.longitude::DOUBLE PRECISION,
    j.job_date::TEXT,
    j.duration,
    j.budget,
    j.status,
    j.created_at,
    j.image,
    (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id)::BIGINT as bid_count,
    j.accepted_bid_id,
    b.id as my_bid_id,
    b.status as my_bid_status,
    b.amount as my_bid_amount,
    (b.negotiation_history -> -1 ->> 'by') as my_bid_last_negotiation_by
  FROM bids b
  JOIN jobs j ON b.job_id = j.id
  WHERE b.worker_id = p_user_id
  ORDER BY b.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 4. Accurate Posted Jobs Feed (Poster Management)
CREATE OR REPLACE FUNCTION get_my_jobs_feed(
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
  job_date TEXT,
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
    COALESCE(j.poster_name, 'Poster'),
    COALESCE(j.poster_phone, ''),
    j.poster_photo,
    j.title,
    j.description,
    j.category,
    j.location,
    j.latitude::DOUBLE PRECISION,
    j.longitude::DOUBLE PRECISION,
    j.job_date::TEXT,
    j.duration,
    j.budget,
    j.status,
    j.created_at,
    j.image,
    (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id)::BIGINT as bid_count,
    j.accepted_bid_id,
    NULL::UUID,
    NULL::TEXT,
    NULL::INTEGER,
    (SELECT (negotiation_history -> -1 ->> 'by') FROM bids WHERE job_id = j.id ORDER BY created_at DESC LIMIT 1)
  FROM jobs j
  WHERE j.poster_id = p_user_id
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 5. GRANTS
GRANT EXECUTE ON FUNCTION get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_applications_feed(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_jobs_feed(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) TO anon;

COMMIT;
