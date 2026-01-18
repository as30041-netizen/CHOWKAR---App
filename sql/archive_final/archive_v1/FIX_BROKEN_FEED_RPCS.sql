-- ============================================
-- FIX BROKEN FEED RPCs, INSERT ISSUES AND PERMISSIONS
-- ============================================

-- 1. DROP POTENTIAL PROBLEMATIC TRIGGERS
DROP TRIGGER IF EXISTS tr_process_job_payment ON jobs;
DROP TRIGGER IF EXISTS check_wallet_before_post ON jobs;
DROP TRIGGER IF EXISTS tr_deduct_coins ON jobs;
DROP FUNCTION IF EXISTS process_job_payment CASCADE;
DROP FUNCTION IF EXISTS check_wallet_balance CASCADE;
DROP FUNCTION IF EXISTS deduct_coins_for_job CASCADE;

-- CRITICAL FIX: Drop existing functions first because we are changing their return signature
DROP FUNCTION IF EXISTS get_my_jobs_feed(uuid, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS get_my_applications_feed(uuid, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(uuid, integer, integer) CASCADE;

-- 2. CREATE get_my_jobs_feed (Poster's View)
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
    (
      SELECT (negotiation_history -> -1 ->> 'by')
      FROM bids b 
      WHERE b.job_id = j.id 
      ORDER BY b.updated_at DESC 
      LIMIT 1
    ) as last_bid_negotiation_by
  FROM jobs j
  WHERE j.poster_id = p_user_id
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 3. CREATE get_my_applications_feed (Worker's View)
CREATE OR REPLACE FUNCTION get_my_applications_feed(
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
    user_bid.id as my_bid_id,
    user_bid.status as my_bid_status,
    user_bid.amount as my_bid_amount,
    (
      CASE 
        WHEN jsonb_array_length(user_bid.negotiation_history) > 0 
        THEN user_bid.negotiation_history -> -1 ->> 'by'
        ELSE NULL
      END
    ) as my_bid_last_negotiation_by
  FROM bids user_bid
  JOIN jobs j ON user_bid.job_id = j.id
  WHERE user_bid.worker_id = p_user_id
  ORDER BY user_bid.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 4. CREATE get_home_feed (General Discovery)
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
    (SELECT id FROM bids WHERE job_id = j.id AND worker_id = p_user_id) as my_bid_id,
    (SELECT status FROM bids WHERE job_id = j.id AND worker_id = p_user_id) as my_bid_status,
    (SELECT amount FROM bids WHERE job_id = j.id AND worker_id = p_user_id) as my_bid_amount,
    (SELECT (negotiation_history -> -1 ->> 'by') FROM bids WHERE job_id = j.id AND worker_id = p_user_id) as my_bid_last_negotiation_by
  FROM jobs j
  WHERE j.status = 'OPEN'
  AND (p_user_id IS NULL OR j.poster_id != p_user_id) -- Don't show own jobs in feed
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 5. GRANT PERMISSIONS (Essential for RPCs to be callable)
GRANT EXECUTE ON FUNCTION get_home_feed TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_my_jobs_feed TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_my_applications_feed TO authenticated, anon, service_role;
