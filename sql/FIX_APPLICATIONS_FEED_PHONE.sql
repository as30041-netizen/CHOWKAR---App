-- FIX: Add poster_phone to get_my_applications_feed RPC
-- This allows workers to see poster's phone number after job acceptance

DROP FUNCTION IF EXISTS get_my_applications_feed(UUID, INTEGER, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION get_my_applications_feed(
  p_user_id UUID,
  p_limit INTEGER,
  p_offset INTEGER
)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT, poster_phone TEXT,
  title TEXT, description TEXT, category TEXT, location TEXT,
  latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
  job_date DATE, duration TEXT, budget INTEGER, status TEXT, created_at TIMESTAMPTZ, image TEXT,
  bid_count BIGINT, accepted_bid_id UUID, my_bid_id UUID, my_bid_status TEXT, my_bid_amount INTEGER,
  my_bid_last_negotiation_by TEXT, has_agreement BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, j.poster_name, j.poster_photo, COALESCE(j.poster_phone, ''),
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

GRANT EXECUTE ON FUNCTION get_my_applications_feed(UUID, INTEGER, INTEGER) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✅ Fixed: get_my_applications_feed now includes poster_phone';
END $$;
