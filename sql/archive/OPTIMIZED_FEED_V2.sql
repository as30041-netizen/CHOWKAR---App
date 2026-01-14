-- ============================================================================
-- 🚀 OPTIMIZED FEED RPC V2
-- Simplified Logic + Better Performance
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION get_home_feed(
  p_user_id UUID,
  p_limit INTEGER,
  p_offset INTEGER,
  p_exclude_completed BOOLEAN DEFAULT FALSE -- Kept for signature compatibility, but effectively ignored as we only show OPEN
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
  -- Optimization: Use LEFT JOIN only if user is logged in
  LEFT JOIN bids b ON (p_user_id IS NOT NULL AND b.job_id = j.id AND b.worker_id = p_user_id)
  WHERE j.status = 'OPEN'
  AND (p_user_id IS NULL OR j.poster_id != p_user_id) -- Don't show my own posts
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) TO authenticated;

COMMIT;
