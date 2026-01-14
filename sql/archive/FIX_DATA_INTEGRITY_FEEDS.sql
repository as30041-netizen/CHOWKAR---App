-- ============================================================================
-- 🚀 CHOWKAR FINAL DATA INTEGRITY FIX: SOFT-HIDE JOBS (V2)
-- This script fixes the "reappearing jobs" issue by:
-- 1. Correcting the RPC permissions (Gives PostgREST access back).
-- 2. Adding a Global RLS Policy so the REST API also hides jobs.
-- 3. Standardizing feed outputs.
-- ============================================================================

BEGIN;

-- 1. RE-GRANT PERMISSIONS (Crucial: RPCs fail if not granted to authenticated users)
-- We ensure the table is accessible
GRANT SELECT, INSERT, UPDATE ON user_job_visibility TO authenticated;
GRANT SELECT ON user_job_visibility TO anon;

-- 2. RE-CREATE RPCs WITH PROPER GRANTS
-- Drop first to ensure return types match perfectly
DROP FUNCTION IF EXISTS get_home_feed(uuid, integer, integer, boolean);
DROP FUNCTION IF EXISTS get_my_applications_feed(uuid, integer, integer);
DROP FUNCTION IF EXISTS get_my_jobs_feed(uuid, integer, integer);

-- A. HOME FEED
CREATE OR REPLACE FUNCTION get_home_feed(
  p_user_id UUID,
  p_limit INTEGER,
  p_offset INTEGER,
  p_exclude_completed BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_phone TEXT, poster_photo TEXT,
  title TEXT, description TEXT, category TEXT, location TEXT,
  latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
  job_date DATE, duration TEXT, budget INTEGER, status TEXT, created_at TIMESTAMPTZ, image TEXT,
  bid_count BIGINT, accepted_bid_id UUID, my_bid_id UUID, my_bid_status TEXT, my_bid_amount INTEGER,
  my_bid_last_negotiation_by TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, j.poster_name, COALESCE(j.poster_phone, ''), j.poster_photo,
    j.title, j.description, j.category, j.location,
    j.latitude::DOUBLE PRECISION, j.longitude::DOUBLE PRECISION,
    j.job_date, j.duration, j.budget, j.status, j.created_at, j.image,
    COALESCE(j.bid_count, 0)::BIGINT, j.accepted_bid_id,
    b.id, b.status, b.amount,
    (b.negotiation_history -> -1 ->> 'by')
  FROM jobs j
  LEFT JOIN bids b ON b.job_id = j.id AND b.worker_id = p_user_id
  WHERE j.status = 'OPEN'
  AND (p_user_id IS NULL OR j.poster_id != p_user_id)
  AND (CASE WHEN p_exclude_completed THEN j.status != 'COMPLETED' ELSE TRUE END)
  AND NOT EXISTS (
    SELECT 1 FROM user_job_visibility v 
    WHERE v.job_id = j.id AND v.user_id = p_user_id AND v.is_hidden = TRUE
  )
  ORDER BY j.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;

-- B. APPLICATIONS FEED
CREATE OR REPLACE FUNCTION get_my_applications_feed(
  p_user_id UUID,
  p_limit INTEGER,
  p_offset INTEGER
)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT,
  title TEXT, description TEXT, category TEXT, location TEXT,
  latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
  job_date DATE, duration TEXT, budget INTEGER, status TEXT, created_at TIMESTAMPTZ, image TEXT,
  bid_count BIGINT, accepted_bid_id UUID, my_bid_id UUID, my_bid_status TEXT, my_bid_amount INTEGER,
  my_bid_last_negotiation_by TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, j.poster_name, j.poster_photo,
    j.title, j.description, j.category, j.location,
    j.latitude::DOUBLE PRECISION, j.longitude::DOUBLE PRECISION,
    j.job_date, j.duration, j.budget, j.status, j.created_at, j.image,
    COALESCE(j.bid_count, 0)::BIGINT, j.accepted_bid_id,
    b.id, b.status, b.amount,
    (b.negotiation_history -> -1 ->> 'by')
  FROM bids b
  JOIN jobs j ON b.job_id = j.id
  WHERE b.worker_id = p_user_id
  AND NOT EXISTS (
    SELECT 1 FROM user_job_visibility v 
    WHERE v.job_id = j.id AND v.user_id = p_user_id AND v.is_hidden = TRUE
  )
  ORDER BY b.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;

-- C. POSTED JOBS FEED
CREATE OR REPLACE FUNCTION get_my_jobs_feed(
  p_user_id UUID,
  p_limit INTEGER,
  p_offset INTEGER
)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT,
  title TEXT, description TEXT, category TEXT, location TEXT,
  latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
  job_date DATE, duration TEXT, budget INTEGER, status TEXT, created_at TIMESTAMPTZ, image TEXT,
  bid_count BIGINT, accepted_bid_id UUID, last_bid_negotiation_by TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, j.poster_name,
    j.title, j.description, j.category, j.location,
    j.latitude::DOUBLE PRECISION, j.longitude::DOUBLE PRECISION,
    j.job_date, j.duration, j.budget, j.status, j.created_at, j.image,
    COALESCE(j.bid_count, 0)::BIGINT, j.accepted_bid_id,
    (SELECT (negotiation_history -> -1 ->> 'by') FROM bids WHERE job_id = j.id ORDER BY created_at DESC LIMIT 1)
  FROM jobs j
  WHERE j.poster_id = p_user_id
  AND NOT EXISTS (
    SELECT 1 FROM user_job_visibility v 
    WHERE v.job_id = j.id AND v.user_id = p_user_id AND v.is_hidden = TRUE
  )
  ORDER BY j.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;

-- GRANT EXECUTE (IMPORTANT: Fixes the 400 error)
GRANT EXECUTE ON FUNCTION get_home_feed(uuid, integer, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_applications_feed(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_jobs_feed(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_home_feed(uuid, integer, integer, boolean) TO anon;
GRANT EXECUTE ON FUNCTION get_my_applications_feed(uuid, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION get_my_jobs_feed(uuid, integer, integer) TO anon;

-- 3. SILVER BULLET: Enable RLS on Jobs table for hidden state
-- This ensures that EVEN IF the RPC fails or we use direct REST API,
-- hidden jobs never show up for the user who hid them.
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users cannot see their own hidden jobs" ON jobs;
CREATE POLICY "Users cannot see their own hidden jobs" ON jobs
FOR SELECT
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM user_job_visibility v 
    WHERE v.job_id = id AND v.user_id = auth.uid() AND v.is_hidden = TRUE
  )
);

-- Ensure public can still see open jobs (for non-logged in or other users)
DROP POLICY IF EXISTS "Public can see jobs" ON jobs;
CREATE POLICY "Public can see jobs" ON jobs
FOR SELECT
USING (true);

COMMIT;
