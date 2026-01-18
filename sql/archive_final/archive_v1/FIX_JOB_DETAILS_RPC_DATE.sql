-- FIX get_job_full_details TO USE CORRECT COLUMN
-- The profiles table uses 'join_date', but the RPC was selecting 'joined_at'.

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
  SELECT 
    id, title, description, category, budget, status, location, 
    created_at, updated_at, poster_id, accepted_bid_id
    -- bid_count -- Column missing
  INTO v_job 
  FROM jobs 
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 2. Fetch Poster Details (FIXED: join_date)
  SELECT id, name, profile_photo, location, join_date
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
    'is_boosted', v_is_boosted,
    'bid_count', 0,
    'poster_name', v_poster.name,
    'poster_photo', v_poster.profile_photo,
    'poster_location', v_poster.location,
    'poster_joined_at', v_poster.join_date, -- FIXED MAPPING
    'bids', COALESCE(v_bids, '[]'::json)
  );
END;
$$;
