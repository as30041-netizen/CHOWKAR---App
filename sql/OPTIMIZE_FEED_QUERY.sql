-- OPTIMIZE FEED QUERY (FIXED AMBIGUITY)
-- Fixes "column reference id is ambiguous" error
-- Updates get_home_feed to use the new cached bid_count column

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
    j.bid_count::BIGINT,
    j.accepted_bid_id,
    -- FIX: Use table alias 'b' and qualify 'b.id' to avoid ambiguity with output param 'id'
    (SELECT b.id FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1) as my_bid_id,
    (SELECT b.status FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1) as my_bid_status,
    (SELECT b.amount FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1) as my_bid_amount,
    (SELECT (b.negotiation_history -> -1 ->> 'by') FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1) as my_bid_last_negotiation_by
  FROM jobs j
  WHERE j.status = 'OPEN'
  AND (p_user_id IS NULL OR j.poster_id != p_user_id)
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) TO authenticated, anon, service_role;
