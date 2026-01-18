-- ============================================================================
-- JOB DETAILS RPC
-- Fetch comprehensive job data including poster info and user-specific bid status
-- ============================================================================

CREATE OR REPLACE FUNCTION get_job_details(p_job_id UUID, p_user_id UUID)
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
  latitude NUMERIC,
  longitude NUMERIC,
  job_date TIMESTAMPTZ,
  duration TEXT,
  budget INTEGER,
  status public.job_status,
  accepted_bid_id UUID,
  image TEXT,
  created_at TIMESTAMPTZ,
  bid_count BIGINT,
  my_bid_id UUID,
  my_bid_status TEXT,
  my_bid_amount INTEGER,
  my_bid_last_negotiation_by TEXT,
  has_agreement BOOLEAN
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
    p.name as poster_name,
    p.phone as poster_phone,
    p.profile_photo as poster_photo,
    j.title,
    j.description,
    j.category,
    j.location,
    j.latitude,
    j.longitude,
    j.job_date,
    j.duration,
    j.budget,
    j.status,
    j.accepted_bid_id,
    j.image,
    j.created_at,
    (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
    b.id as my_bid_id,
    b.status::TEXT as my_bid_status,
    b.amount as my_bid_amount,
    (b.negotiation_history->-1->>'by') as my_bid_last_negotiation_by,
    EXISTS (
      SELECT 1 FROM bids b2 
      WHERE b2.job_id = j.id 
      AND (b2.negotiation_history->-1->>'agreed')::boolean = true
    ) as has_agreement
  FROM jobs j
  JOIN profiles p ON p.id = j.poster_id
  LEFT JOIN bids b ON b.job_id = j.id AND b.worker_id = p_user_id
  WHERE j.id = p_job_id;
END;
$$;
