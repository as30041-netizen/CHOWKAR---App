-- ============================================================================
-- RESTORE MISSING FEED RPCs
-- Fixes 400 Error in My Jobs / Home Feed / My Applications
-- ============================================================================

BEGIN;

-- 1. CLEANUP (Drop first to avoid signature conflicts)
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER) CASCADE; -- Variant check
DROP FUNCTION IF EXISTS get_my_applications_feed(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INTEGER, INTEGER) CASCADE;

-- 2. GET MY JOBS FEED (Poster Dashboard)
-- Returns: Jobs posted by user with bid summaries
CREATE OR REPLACE FUNCTION get_my_jobs_feed(
  p_user_id UUID,
  p_limit INTEGER,
  p_offset INTEGER
)
RETURNS TABLE (
  id UUID, 
  poster_id UUID, 
  poster_name TEXT,
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
  has_new_bid BOOLEAN,         -- Frontend expects this
  action_required_count BIGINT -- Frontend expects this
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
    j.title, 
    j.description, 
    j.category, 
    j.location, 
    j.latitude::DOUBLE PRECISION, 
    j.longitude::DOUBLE PRECISION,
    j.job_date, 
    j.duration, 
    j.budget, 
    j.status::TEXT, 
    j.created_at, 
    j.image,
    COALESCE(j.bid_count, 0)::BIGINT, 
    j.accepted_bid_id,
    -- Computed: Has new bid (any PENDING bid < 24h old)
    EXISTS (
        SELECT 1 FROM bids b 
        WHERE b.job_id = j.id 
        AND b.status = 'PENDING' 
        AND b.created_at > (NOW() - INTERVAL '24 hours')
    ),
    -- Computed: Action required (Pending bids count)
    (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id AND b.status = 'PENDING')
  FROM jobs j
  WHERE j.poster_id = p_user_id
  ORDER BY j.created_at DESC 
  LIMIT p_limit OFFSET p_offset;
END;
$$;


-- 3. GET HOME FEED (Worker Discovery)
-- Returns: Open jobs exclude own, plus my bid status
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
  my_bid_amount INTEGER
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
    COALESCE(j.poster_phone, ''), 
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
    j.status::TEXT, 
    j.created_at, 
    j.image,
    COALESCE(j.bid_count, 0)::BIGINT, 
    j.accepted_bid_id,
    b.id,                -- my_bid_id
    b.status::TEXT,      -- my_bid_status
    b.amount             -- my_bid_amount
  FROM jobs j
  LEFT JOIN bids b ON b.job_id = j.id AND b.worker_id = p_user_id
  WHERE j.status = 'OPEN'
    AND (p_user_id IS NULL OR j.poster_id != p_user_id)
  ORDER BY j.created_at DESC 
  LIMIT p_limit OFFSET p_offset;
END;
$$;


-- 4. GET MY APPLICATIONS FEED (Worker Dashboard)
-- Returns: Jobs I have bid on
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
  my_bid_amount INTEGER
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
    j.status::TEXT, 
    j.created_at, 
    j.image,
    COALESCE(j.bid_count, 0)::BIGINT, 
    j.accepted_bid_id,
    b.id, 
    b.status::TEXT, 
    b.amount
  FROM bids b
  JOIN jobs j ON b.job_id = j.id
  WHERE b.worker_id = p_user_id
  ORDER BY b.created_at DESC 
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 5. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION get_my_jobs_feed(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_applications_feed(UUID, INTEGER, INTEGER) TO authenticated;

COMMIT;
