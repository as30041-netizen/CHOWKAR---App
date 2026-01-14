-- ============================================
-- FIX FEEDS V22 (AGREEMENT VISIBILITY)
-- 1. Add 'has_agreement' to all feed RPCs
-- 2. Ensure posters can see when workers have agreed
-- 3. Ensure workers can see their own agreement status
-- ============================================

-- A. CLEANUP OLD FUNCTIONS
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS get_my_applications_feed(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INTEGER, INTEGER) CASCADE;

-- 1. HOME FEED (Worker Discovery)
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
  my_bid_last_negotiation_by TEXT, has_agreement BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, j.poster_name, COALESCE(j.poster_phone, ''), j.poster_photo,
    j.title, j.description, j.category, j.location,
    j.latitude::DOUBLE PRECISION, j.longitude::DOUBLE PRECISION,
    j.job_date, j.duration, j.budget, j.status, j.created_at, j.image,
    COALESCE(j.bid_count, 0)::BIGINT, j.accepted_bid_id,
    b.id, b.status, b.amount,
    (b.negotiation_history -> -1 ->> 'by'),
    (b.negotiation_history -> -1 ->> 'agreed')::BOOLEAN
  FROM jobs j
  LEFT JOIN bids b ON b.job_id = j.id AND b.worker_id = p_user_id
  WHERE j.status = 'OPEN'
    AND (p_user_id IS NULL OR j.poster_id != p_user_id)
    AND (CASE WHEN p_exclude_completed THEN j.status != 'COMPLETED' ELSE TRUE END)
  ORDER BY j.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 2. MY APPLICATIONS (Worker View)
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
  my_bid_last_negotiation_by TEXT, has_agreement BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, j.poster_name, j.poster_photo,
    j.title, j.description, j.category, j.location,
    j.latitude::DOUBLE PRECISION, j.longitude::DOUBLE PRECISION,
    j.job_date, j.duration, j.budget, j.status, j.created_at, j.image,
    COALESCE(j.bid_count, 0)::BIGINT, j.accepted_bid_id,
    b.id, b.status, b.amount,
    (b.negotiation_history -> -1 ->> 'by'),
    (b.negotiation_history -> -1 ->> 'agreed')::BOOLEAN
  FROM bids b
  JOIN jobs j ON b.job_id = j.id
  WHERE b.worker_id = p_user_id
  ORDER BY b.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 3. MY JOBS (Poster View)
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
  bid_count BIGINT, accepted_bid_id UUID, last_bid_negotiation_by TEXT, has_agreement BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, j.poster_name,
    j.title, j.description, j.category, j.location,
    j.latitude::DOUBLE PRECISION, j.longitude::DOUBLE PRECISION,
    j.job_date, j.duration, j.budget, j.status, j.created_at, j.image,
    COALESCE(j.bid_count, 0)::BIGINT, j.accepted_bid_id,
    (SELECT (negotiation_history -> -1 ->> 'by') FROM bids WHERE job_id = j.id ORDER BY updated_at DESC LIMIT 1),
    EXISTS (SELECT 1 FROM bids WHERE job_id = j.id AND (negotiation_history -> -1 ->> 'agreed')::BOOLEAN = TRUE)
  FROM jobs j
  WHERE j.poster_id = p_user_id
  ORDER BY j.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 4. PERMISSIONS
GRANT EXECUTE ON FUNCTION get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_applications_feed(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_jobs_feed(UUID, INTEGER, INTEGER) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✅ V22 Feeds with Agreement Visibility Deployed.';
END $$;
