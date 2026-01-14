-- FIX GET_MY_JOBS_FEED RPC - Resolve ambiguous column references

DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INTEGER, INTEGER) CASCADE;

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
    (SELECT (b.negotiation_history -> -1 ->> 'by') FROM bids b WHERE b.job_id = j.id ORDER BY b.updated_at DESC LIMIT 1),
    EXISTS (SELECT 1 FROM bids b WHERE b.job_id = j.id AND (b.negotiation_history -> -1 ->> 'agreed')::BOOLEAN = TRUE)
  FROM jobs j
  WHERE j.poster_id = p_user_id
  ORDER BY j.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_jobs_feed(UUID, INTEGER, INTEGER) TO authenticated;

-- Test it
SELECT * FROM get_my_jobs_feed(
  'e266fa3d-d854-4445-be8b-cd054a2fa859'::UUID,
  20,
  0
);
