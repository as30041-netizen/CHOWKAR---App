-- FINAL RPC FIX ALL
-- Force-restore all critical functions and permissions to resolve 404s and "Not Found" errors

BEGIN;

-- 0. CLEANUP (Drop potentially conflicting overloads)
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(INTEGER, INTEGER, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_job_full_details(UUID) CASCADE;

-- 1. Ensure Columns Exist (Safety measure)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. get_job_full_details (The details view)
CREATE OR REPLACE FUNCTION get_job_full_details(
  p_job_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_bids JSON;
  v_poster RECORD;
  v_is_boosted BOOLEAN := FALSE;
BEGIN
  -- Fetch Job (Explicit columns to avoid errors)
  SELECT 
    id, title, description, category, budget, status, location, 
    created_at, updated_at, poster_id, accepted_bid_id
  INTO v_job 
  FROM jobs 
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Fetch Poster
  SELECT id, name, profile_photo, location, join_date
  INTO v_poster
  FROM profiles 
  WHERE id = v_job.poster_id;

  -- Fetch Bids with Worker Profiles
  SELECT json_agg(
    json_build_object(
      'id', b.id,
      'job_id', b.job_id,
      'worker_id', b.worker_id,
      'amount', b.amount,
      'status', b.status,
      'created_at', b.created_at,
      'worker_name', p.name,
      'worker_photo', p.profile_photo,
      'worker_rating', p.rating,
      'worker_location', p.location,
      'review_count', p.review_count
    )
  ) INTO v_bids
  FROM bids b
  JOIN profiles p ON b.worker_id = p.id
  WHERE b.job_id = p_job_id;

  -- Construct Result
  RETURN json_build_object(
    'id', v_job.id,
    'title', v_job.title,
    'description', v_job.description,
    'category', v_job.category,
    'budget', v_job.budget,
    'status', v_job.status,
    'location', v_job.location,
    'created_at', v_job.created_at,
    'poster_id', v_job.poster_id,
    'accepted_bid_id', v_job.accepted_bid_id,
    'is_boosted', v_is_boosted,
    'bid_count', (SELECT COUNT(*) FROM bids WHERE job_id = p_job_id),
    'poster_name', COALESCE(v_poster.name, 'Unknown'),
    'poster_photo', v_poster.profile_photo,
    'poster_location', v_poster.location,
    'poster_joined_at', v_poster.join_date,
    'bids', COALESCE(v_bids, '[]'::json)
  );
END;
$$;

-- 3. get_home_feed (The optimized feed)
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
    (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id)::BIGINT as bid_count,
    j.accepted_bid_id,
    (SELECT id FROM bids WHERE job_id = j.id AND worker_id = p_user_id LIMIT 1) as my_bid_id,
    (SELECT status FROM bids WHERE job_id = j.id AND worker_id = p_user_id LIMIT 1) as my_bid_status,
    (SELECT amount FROM bids WHERE job_id = j.id AND worker_id = p_user_id LIMIT 1) as my_bid_amount,
    (SELECT (negotiation_history -> -1 ->> 'by') FROM bids WHERE job_id = j.id AND worker_id = p_user_id LIMIT 1) as my_bid_last_negotiation_by
  FROM jobs j
  WHERE j.status = 'OPEN'
  AND (p_user_id IS NULL OR j.poster_id != p_user_id)
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 4. GRANT PERMISSIONS (Critical)
GRANT EXECUTE ON FUNCTION get_job_full_details(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) TO authenticated, anon, service_role;

COMMIT;
