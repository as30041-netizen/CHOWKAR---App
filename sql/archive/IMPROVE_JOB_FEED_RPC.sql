-- ============================================
-- IMPROVE JOB FEED RPC - ACTION REQUIRED LOGIC
-- ============================================
-- Objective: 
-- 1. Accurately flag jobs that require poster attention (Worker countered or New Bid)
-- 2. Prevent "Latest Bid" masking issues where an older bid needs attention but is hidden by a newer bid
-- 3. Populate 'has_new_counter' correctly for the frontend

-- DROP OLD FUNCTION
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INTEGER, INTEGER) CASCADE;

-- CREATE IMPROVED FUNCTION
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
  bid_count BIGINT, accepted_bid_id UUID, 
  last_bid_negotiation_by TEXT, -- Keep for backward compatibility
  has_agreement BOOLEAN,
  has_new_counter BOOLEAN,      -- NEW: Explicit flag if ANY bid has a worker counter
  action_required_count INTEGER -- NEW: Count of bids needing attention
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, j.poster_name,
    j.title, j.description, j.category, j.location,
    j.latitude::DOUBLE PRECISION, j.longitude::DOUBLE PRECISION,
    j.job_date, j.duration, j.budget, j.status, j.created_at, j.image,
    COALESCE(j.bid_count, 0)::BIGINT, j.accepted_bid_id,
    
    -- 1. Latest negotiation person (from the MOST RECENTLY UPDATED bid)
    (SELECT (negotiation_history -> -1 ->> 'by') 
     FROM bids 
     WHERE job_id = j.id 
     ORDER BY updated_at DESC 
     LIMIT 1),
    
    -- 2. Has Agreement (Any bid agreed)
    EXISTS (SELECT 1 FROM bids WHERE job_id = j.id AND (negotiation_history -> -1 ->> 'agreed')::BOOLEAN = TRUE),

    -- 3. Has New Counter (ANY pending bid where last move was WORKER)
    EXISTS (
      SELECT 1 FROM bids 
      WHERE job_id = j.id 
      AND status = 'PENDING'
      AND (negotiation_history -> -1 ->> 'by') = 'WORKER'
    ),

    -- 4. Action Required Count (Worker counters needed response)
    (SELECT count(*)::INTEGER 
     FROM bids 
     WHERE job_id = j.id 
     AND status = 'PENDING'
     AND (negotiation_history -> -1 ->> 'by') = 'WORKER')

  FROM jobs j
  WHERE j.poster_id = p_user_id
  ORDER BY j.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;

-- GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION get_my_jobs_feed(UUID, INTEGER, INTEGER) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✅ Improved Job Feed RPC Deployed.';
END $$;
