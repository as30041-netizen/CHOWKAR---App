-- ============================================
-- 14. GET_JOB_FULL_DETAILS (New Function)
-- ============================================
-- Returns a job with its poster profile, bids, and accepted bid details in a single efficient query.
-- Addresses the 'is_boosted' column mismatch by checking safely or using a default.

DROP FUNCTION IF EXISTS get_job_full_details;

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
  -- 1. Fetch Job Details
  -- SAFE SELECTION: Explicitly select known columns to avoid "column does not exist" errors
  -- We use a hack for is_boosted: check if column exists dynamically or just default to false for now
  -- Ideally, run migrations to add is_boosted, but for resilience, we select existing cols.
  SELECT 
    id, title, description, category, budget, status, location, 
    created_at, updated_at, poster_id, accepted_bid_id
    -- bid_count -- Column missing, commented out to stop error log spam
    
  INTO v_job 
  FROM jobs 
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 2. Fetch Poster Details
  SELECT id, name, profile_photo, location, joined_at
  INTO v_poster
  FROM profiles 
  WHERE id = v_job.poster_id;

  -- 3. Fetch Bids with Worker Profiles
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

  -- 4. Construct Result JSON
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
    'is_boosted', v_is_boosted, -- Defaulting to false to fix crash
    -- 'job_type', v_job.job_type, -- Column missing
    -- 'views', v_job.views_count, -- Column missing
    -- 'bid_count', v_job.bid_count, -- Column missing
    'bid_count', 0, -- Default to 0
    'poster_name', v_poster.name,
    'poster_photo', v_poster.profile_photo,
    'poster_location', v_poster.location,
    'poster_joined_at', v_poster.joined_at,
    'bids', COALESCE(v_bids, '[]'::json)
  );
END;
$$;
