-- ============================================================================
-- SQL: ADD TRANSLATIONS TO JOB DETAILS RPC
-- Purpose: Return cached translations when fetching job details
-- ============================================================================

-- Update get_job_details to include translations column
DROP FUNCTION IF EXISTS get_job_details(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_job_details(p_job_id UUID, p_user_id UUID)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_phone TEXT, poster_photo TEXT, poster_rating NUMERIC,
  title TEXT, description TEXT, category TEXT, location TEXT, latitude NUMERIC, longitude NUMERIC,
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT,
  accepted_bid_id UUID, image TEXT, created_at TIMESTAMPTZ, bid_count BIGINT,
  my_bid_id UUID, my_bid_status TEXT, my_bid_amount INTEGER, my_bid_last_negotiation_by TEXT,
  has_agreement BOOLEAN, action_required_count BIGINT, has_my_review BOOLEAN,
  translations JSONB  -- NEW: Cached translations
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, p.name as poster_name, p.phone as poster_phone, p.profile_photo as poster_photo, p.rating as poster_rating,
    j.title, j.description, j.category, j.location, j.latitude, j.longitude,
    j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.accepted_bid_id, j.image, j.created_at,
    (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
    b.id as my_bid_id, UPPER(b.status::TEXT) as my_bid_status, b.amount as my_bid_amount,
    (b.negotiation_history->-1->>'by') as my_bid_last_negotiation_by,
    EXISTS (SELECT 1 FROM bids b2 WHERE b2.job_id = j.id AND (b2.negotiation_history->-1->>'agreed')::boolean = true) as has_agreement,
    (SELECT COUNT(*) FROM bids b3 WHERE b3.job_id = j.id AND b3.status = 'PENDING') as action_required_count,
    EXISTS (SELECT 1 FROM reviews r WHERE r.job_id = j.id AND r.reviewer_id = p_user_id) as has_my_review,
    COALESCE(j.translations, '{}'::jsonb) as translations  -- NEW
  FROM jobs j
  JOIN profiles p ON p.id = j.poster_id
  LEFT JOIN bids b ON b.job_id = j.id AND b.worker_id = p_user_id
  WHERE j.id = p_job_id;
END;
$$;

DO $$ 
BEGIN 
    RAISE NOTICE '✅ get_job_details updated with translations column.'; 
END $$;
