-- ============================================================================
-- SQL: FIX POSTER FEED ALERTS (Phase 46)
-- Purpose: Fix 'Transient Alerts' bug where job cards don't show "Action Required"
--          on refresh because the SQL query wasn't detecting pending bids correctly
--          (likely due to case sensitivity or missing negotiation logic).
-- ============================================================================

BEGIN;

-- Drop function to ensure clean replacement
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INTEGER, INTEGER);

-- Re-create get_my_jobs_feed with ROBUST logic
CREATE OR REPLACE FUNCTION get_my_jobs_feed(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT, poster_rating NUMERIC,
  title TEXT, description TEXT, category TEXT, location TEXT, latitude NUMERIC, longitude NUMERIC,
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT, image TEXT,
  created_at TIMESTAMPTZ, bid_count BIGINT, accepted_bid_id UUID,
  action_required_count BIGINT, has_new_bid BOOLEAN, has_my_review BOOLEAN,
  hired_worker_id UUID, hired_worker_name TEXT, hired_worker_phone TEXT,
  translations JSONB,
  my_bid_last_negotiation_by TEXT -- Added for completeness if needed (though mainly for worker feed)
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
    
    -- [CRITICAL FIX] Robust Action Required Count
    -- 1. Status must be PENDING (Case Insensitive)
    -- 2. Either no negotiation history (standard bid) OR Last negotiation was NOT by Poster (Worker Countered)
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

    -- [CRITICAL FIX] Robust New Bid Flag
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
    NULL::TEXT as my_bid_last_negotiation_by -- Placeholder to match return type structure if we reused generalized types, but here we define explicit table
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
    RAISE NOTICE '✅ FIX_POSTER_FEED_ALERTS deployed successfully.'; 
END $$;
