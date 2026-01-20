-- ============================================================================
-- SQL: FORCE FIX POSTER FEED (Phase 47)
-- Purpose: Aggressively fix the 'get_my_jobs_feed' 400 Bad Request error.
--          The error implies a signature mismatch (Postgres can't find the function
--          matching the parameters sent by the app).
-- ============================================================================

BEGIN;

-- 1. Aggressively DROP all potential variations of the function
--    (Ignores errors if they don't exist)
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID);
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INT, INT); -- Just in case

-- 2. Re-create the function with EXACT parameter names expected by App
--    App sends: { p_user_id, p_limit, p_offset }
CREATE OR REPLACE FUNCTION get_my_jobs_feed(
    p_user_id UUID, 
    p_limit INTEGER DEFAULT 20, 
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT, poster_rating NUMERIC,
  title TEXT, description TEXT, category TEXT, location TEXT, latitude NUMERIC, longitude NUMERIC,
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT, image TEXT,
  created_at TIMESTAMPTZ, bid_count BIGINT, accepted_bid_id UUID,
  action_required_count BIGINT, has_new_bid BOOLEAN, has_my_review BOOLEAN,
  hired_worker_id UUID, hired_worker_name TEXT, hired_worker_phone TEXT,
  translations JSONB,
  my_bid_last_negotiation_by TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, p.name as poster_name, p.profile_photo as poster_photo, p.rating as poster_rating,
    j.title, j.description, j.category, j.location, j.latitude, j.longitude,
    j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.image,
    j.created_at,
    (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
    j.accepted_bid_id,
    
    -- Action Required Logic (Robust)
    (
        SELECT COUNT(*) 
        FROM bids b 
        WHERE b.job_id = j.id 
          AND UPPER(b.status::TEXT) = 'PENDING'
          AND (
             b.negotiation_history IS NULL 
             OR jsonb_array_length(b.negotiation_history) = 0
             OR (b.negotiation_history -> -1 ->> 'by') IS DISTINCT FROM 'POSTER'
          )
    ) as action_required_count,

    -- New Bid Logic
    EXISTS (
        SELECT 1 
        FROM bids b2 
        WHERE b2.job_id = j.id 
          AND UPPER(b2.status::TEXT) = 'PENDING' 
          AND b2.created_at > (NOW() - INTERVAL '24 hours')
    ) as has_new_bid,

    EXISTS (SELECT 1 FROM reviews r WHERE r.job_id = j.id AND r.reviewer_id = p_user_id) as has_my_review,
    j.hired_worker_id, worker.name as hired_worker_name, worker.phone as hired_worker_phone,
    COALESCE(j.translations, '{}'::jsonb) as translations,
    -- Return NULL for this field since it's not applicable to Posters, but keeps return signature consistent if needed
    NULL::TEXT as my_bid_last_negotiation_by 
  FROM jobs j
  JOIN profiles p ON p.id = j.poster_id
  LEFT JOIN profiles worker ON worker.id = j.hired_worker_id
  LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
  WHERE j.poster_id = p_user_id
    AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
  ORDER BY j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMIT;

DO $$ 
BEGIN 
    RAISE NOTICE '✅ FORCE_FIX_POSTER_FEED executed successfully.'; 
END $$;
