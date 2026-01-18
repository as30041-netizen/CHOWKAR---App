-- ============================================================================
-- ENHANCE FEED WITH WORKER PHONE
-- Allows "Call Worker" button on Poster Dashboard for IN_PROGRESS jobs
-- ============================================================================

-- Safe drop to allow return type change (Must be executed before CREATE)
DROP FUNCTION IF EXISTS get_my_jobs_feed(uuid, integer, integer);

CREATE OR REPLACE FUNCTION get_my_jobs_feed(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT, poster_rating NUMERIC,
  title TEXT, description TEXT, category TEXT, location TEXT, latitude NUMERIC, longitude NUMERIC,
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT,
  created_at TIMESTAMPTZ, bid_count BIGINT, accepted_bid_id UUID,
  action_required_count BIGINT, has_new_bid BOOLEAN, has_my_review BOOLEAN,
  hired_worker_name TEXT, hired_worker_phone TEXT, hired_worker_id UUID
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, p.name as poster_name, p.profile_photo as poster_photo, p.rating as poster_rating,
    j.title, j.description, j.category, j.location, j.latitude, j.longitude,
    j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.created_at,
    (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
    j.accepted_bid_id,
    (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id AND b.status = 'PENDING') as action_required_count,
    EXISTS (SELECT 1 FROM bids b2 WHERE b2.job_id = j.id AND b2.status = 'PENDING' AND b2.created_at > (NOW() - INTERVAL '24 hours')) as has_new_bid,
    EXISTS (SELECT 1 FROM reviews r WHERE r.job_id = j.id AND r.reviewer_id = p_user_id) as has_my_review,
    -- New Fields for Hired Worker
    w.name as hired_worker_name,
    w.phone as hired_worker_phone,
    w.id as hired_worker_id
  FROM jobs j
  JOIN profiles p ON p.id = j.poster_id
  LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
  -- Join to get hired worker details if job is IN_PROGRESS/COMPLETED
  LEFT JOIN bids b_accepted ON b_accepted.id = j.accepted_bid_id
  LEFT JOIN profiles w ON w.id = b_accepted.worker_id
  WHERE j.poster_id = p_user_id
    AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
  ORDER BY j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
