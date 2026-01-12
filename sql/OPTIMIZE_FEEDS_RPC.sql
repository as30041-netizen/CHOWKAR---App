-- ============================================================================
-- 🚀 CHOWKAR BIDDING & FEED OPTIMIZATION PACKAGE
-- Resolves: Timeouts, Return Type Mismatches, and Missing Worker Details
-- ============================================================================

BEGIN;

-- 1. CLEANUP (Required because we are changing return types)
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_my_applications_feed(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS action_place_bid(UUID, INTEGER, TEXT) CASCADE;

-- 2. OPTIMIZED HOME FEED
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
    j.status,
    j.created_at,
    j.image,
    COALESCE(j.bid_count, 0)::BIGINT as bid_count,
    j.accepted_bid_id,
    b.id as my_bid_id,
    b.status as my_bid_status,
    b.amount as my_bid_amount,
    (b.negotiation_history -> -1 ->> 'by') as my_bid_last_negotiation_by
  FROM jobs j
  LEFT JOIN bids b ON b.job_id = j.id AND b.worker_id = p_user_id
  WHERE j.status = 'OPEN'
  AND (p_user_id IS NULL OR j.poster_id != p_user_id)
  AND (CASE WHEN p_exclude_completed THEN j.status != 'COMPLETED' ELSE TRUE END)
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 3. OPTIMIZED APPLICATIONS FEED (Worker View)
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
    COALESCE(j.bid_count, 0)::BIGINT as bid_count,
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

-- 4. OPTIMIZED POSTED JOBS FEED (Poster View)
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
  last_bid_negotiation_by TEXT
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
    j.status,
    j.created_at,
    j.image,
    COALESCE(j.bid_count, 0)::BIGINT as bid_count,
    j.accepted_bid_id,
    (SELECT (negotiation_history -> -1 ->> 'by') FROM bids WHERE job_id = j.id ORDER BY created_at DESC LIMIT 1) as last_bid_negotiation_by
  FROM jobs j
  WHERE j.poster_id = p_user_id
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 5. FIXED ACTION: PLACE BID
-- Includes automatic denormalization of worker details to resolve NOT NULL constraints
CREATE OR REPLACE FUNCTION action_place_bid(
    p_job_id UUID,
    p_amount INTEGER,
    p_message TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_status TEXT;
    v_poster_id UUID;
    v_new_bid_id UUID;
    v_worker_id UUID := auth.uid();
    -- Worker Metadata
    v_worker_name TEXT;
    v_worker_phone TEXT;
    v_worker_photo TEXT;
    v_worker_location TEXT;
    v_worker_rating NUMERIC;
    v_worker_lat DOUBLE PRECISION;
    v_worker_lng DOUBLE PRECISION;
BEGIN
    SELECT status, poster_id INTO v_job_status, v_poster_id FROM jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job closed'); END IF;
    IF v_poster_id = v_worker_id THEN RETURN json_build_object('success', false, 'error', 'Cannot bid on own job'); END IF;
    IF EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id AND worker_id = v_worker_id) THEN
        RETURN json_build_object('success', false, 'error', 'Already bid');
    END IF;

    -- Denormalize worker profile
    SELECT name, phone, profile_photo, location, rating, latitude, longitude 
    INTO v_worker_name, v_worker_phone, v_worker_photo, v_worker_location, v_worker_rating, v_worker_lat, v_worker_lng
    FROM profiles WHERE id = v_worker_id;

    INSERT INTO bids (
        job_id, worker_id, poster_id, amount, message, status, 
        worker_name, worker_phone, worker_photo, worker_location, 
        worker_rating, worker_latitude, worker_longitude
    )
    VALUES (
        p_job_id, v_worker_id, v_poster_id, p_amount, p_message, 'PENDING',
        COALESCE(v_worker_name, 'Worker'), v_worker_phone, v_worker_photo, v_worker_location,
        COALESCE(v_worker_rating, 0), v_worker_lat, v_worker_lng
    )
    RETURNING id INTO v_new_bid_id;

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id);
END;
$$;

-- 6. PERMISSIONS
GRANT EXECUTE ON FUNCTION get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_applications_feed(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_jobs_feed(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION action_place_bid(UUID, INTEGER, TEXT) TO authenticated;

-- Ensure bid_count index for speed
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS bid_count INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_bids_composite ON bids(job_id, worker_id);

COMMIT;
