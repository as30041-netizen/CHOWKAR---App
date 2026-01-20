-- ============================================================================
-- SQL: UNIVERSAL TRANSLATION FEEDS (Phase 41)
-- Purpose: Return cached translations in ALL feeds (Home, Dashboard, History)
--          to enable "Viral Caching" and consistent localized experience.
-- ============================================================================

BEGIN;

-- 1. DROP Existing Functions (Cascade required to update return type)
-- 1. DROP Existing Functions (Robust Cleanup)
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, TEXT, TEXT); -- Drop simpler signature
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN); -- Drop older signature
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_my_applications_feed(UUID, INTEGER, INTEGER);

-- 2. GET_HOME_FEED (Discovery) - Updated with translations
-- 2. GET_HOME_FEED (Discovery) - Fully Compatible Signature
-- 2. GET_HOME_FEED (Discovery) - Fully Compatible Signature
CREATE OR REPLACE FUNCTION get_home_feed(
  p_user_id UUID, 
  p_limit INTEGER DEFAULT 20, 
  p_offset INTEGER DEFAULT 0, 
  p_category TEXT DEFAULT NULL, 
  p_search_query TEXT DEFAULT NULL,
  p_feed_mode TEXT DEFAULT 'RECOMMENDED',
  p_sort_by TEXT DEFAULT 'NEWEST',
  p_min_budget INTEGER DEFAULT NULL,
  p_max_distance INTEGER DEFAULT NULL,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT, poster_rating NUMERIC,
  title TEXT, description TEXT, category TEXT, location TEXT, latitude NUMERIC, longitude NUMERIC,
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT, image TEXT, -- Added Image
  created_at TIMESTAMPTZ, bid_count BIGINT, my_bid_id UUID,
  is_recommended BOOLEAN,
  translations JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_skills TEXT[];
    v_skill_pattern TEXT;
BEGIN
    -- 1. Fetch User Skills for recommendation logic
    SELECT skills INTO v_user_skills FROM profiles p_prof WHERE p_prof.id = p_user_id;

    -- 2. Create regex for skills
    IF v_user_skills IS NOT NULL THEN
        SELECT string_agg(regexp_replace(skill, '([!$()*+.:<=>?[\\\]^{|}-])', '\\\1', 'g'), '|')
        INTO v_skill_pattern
        FROM unnest(v_user_skills) AS skill
        WHERE skill IS NOT NULL AND length(skill) > 0;
    END IF;

  RETURN QUERY
  SELECT 
    j.id, j.poster_id, p.name as poster_name, p.profile_photo as poster_photo, p.rating as poster_rating,
    j.title, j.description, j.category, j.location, j.latitude, j.longitude,
    j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.image, -- Added Image
    j.created_at,
    (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
    b.id as my_bid_id,
    -- Recommendation Logic
    (
        v_user_skills IS NOT NULL AND (
            j.category = ANY(v_user_skills) OR 
            (v_skill_pattern IS NOT NULL AND v_skill_pattern <> '' AND (j.title ~* v_skill_pattern OR j.description ~* v_skill_pattern))
        )
    ) AS is_recommended,
    COALESCE(j.translations, '{}'::jsonb) as translations
  FROM jobs j
  JOIN profiles p ON p.id = j.poster_id
  LEFT JOIN bids b ON b.job_id = j.id AND b.worker_id = p_user_id
  LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
  WHERE j.status = 'OPEN' 
    AND j.poster_id != p_user_id
    AND b.id IS NULL -- Exclude jobs already bid on
    AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
    AND (p_category IS NULL OR j.category = p_category)
    AND (p_search_query IS NULL OR (j.title || j.description) ILIKE '%' || p_search_query || '%')
    -- Distance Filter
    AND (p_max_distance IS NULL OR (
        j.latitude IS NOT NULL AND j.longitude IS NOT NULL AND p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND
        (point(j.longitude, j.latitude) <@> point(p_user_lng, p_user_lat)) <= (p_max_distance / 1.60934) 
    ))
  ORDER BY 
    -- 1. Primary Sort: Distance (if NEAREST)
    CASE WHEN p_sort_by = 'NEAREST' AND p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
       (point(j.longitude, j.latitude) <@> point(p_user_lng, p_user_lat))
    ELSE 0 END ASC,

    -- 2. Secondary Sort: Recommendations (Boost matching jobs if NOT sorting by distance)
    CASE WHEN p_sort_by != 'NEAREST' AND (
        v_user_skills IS NOT NULL AND (
            j.category = ANY(v_user_skills) OR 
            (v_skill_pattern IS NOT NULL AND v_skill_pattern <> '' AND (j.title ~* v_skill_pattern OR j.description ~* v_skill_pattern))
        )
    ) THEN 0 ELSE 1 END ASC,

    -- 3. Tertiary Sort: Newest First
    j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 3. GET_MY_JOBS_FEED (Poster Dashboard) - Updated with translations & hired worker info
CREATE OR REPLACE FUNCTION get_my_jobs_feed(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT, poster_rating NUMERIC,
  title TEXT, description TEXT, category TEXT, location TEXT, latitude NUMERIC, longitude NUMERIC,
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT, image TEXT, -- Added Image
  created_at TIMESTAMPTZ, bid_count BIGINT, accepted_bid_id UUID,
  action_required_count BIGINT, has_new_bid BOOLEAN, has_my_review BOOLEAN,
  hired_worker_id UUID, hired_worker_name TEXT, hired_worker_phone TEXT, -- Added Hired Worker Info
  translations JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, p.name as poster_name, p.profile_photo as poster_photo, p.rating as poster_rating,
    j.title, j.description, j.category, j.location, j.latitude, j.longitude,
    j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.image, -- Added Image
    j.created_at,
    (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
    j.accepted_bid_id,
    (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id AND b.status = 'PENDING') as action_required_count,
    EXISTS (SELECT 1 FROM bids b2 WHERE b2.job_id = j.id AND b2.status = 'PENDING' AND b2.created_at > (NOW() - INTERVAL '24 hours')) as has_new_bid,
    EXISTS (SELECT 1 FROM reviews r WHERE r.job_id = j.id AND r.reviewer_id = p_user_id) as has_my_review,
    j.hired_worker_id, worker.name as hired_worker_name, worker.phone as hired_worker_phone, -- Added Hired Worker Info
    COALESCE(j.translations, '{}'::jsonb) as translations
  FROM jobs j
  JOIN profiles p ON p.id = j.poster_id
  LEFT JOIN profiles worker ON worker.id = j.hired_worker_id -- Join for hired worker info
  LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
  WHERE j.poster_id = p_user_id
    AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
  ORDER BY j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 4. GET_MY_APPLICATIONS_FEED (Worker Dashboard) - Updated with translations & poster phone
CREATE OR REPLACE FUNCTION get_my_applications_feed(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_phone TEXT, poster_photo TEXT, poster_rating NUMERIC, -- Added Poster Phone
  title TEXT, description TEXT, category TEXT, location TEXT, latitude NUMERIC, longitude NUMERIC,
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT, image TEXT, -- Added Image
  created_at TIMESTAMPTZ, bid_count BIGINT, 
  my_bid_id UUID, my_bid_status TEXT, my_bid_amount INTEGER, my_bid_last_negotiation_by TEXT,
  accepted_bid_id UUID, has_my_review BOOLEAN,
  translations JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, p.name as poster_name, p.phone as poster_phone, p.profile_photo as poster_photo, p.rating as poster_rating, -- Added Poster Phone
    j.title, j.description, j.category, j.location, j.latitude, j.longitude,
    j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.image, -- Added Image
    j.created_at,
    (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
    b.id as my_bid_id, UPPER(b.status::TEXT) as my_bid_status, b.amount as my_bid_amount,
    (b.negotiation_history->-1->>'by') as my_bid_last_negotiation_by,
    j.accepted_bid_id,
    EXISTS (SELECT 1 FROM reviews r WHERE r.job_id = j.id AND r.reviewer_id = p_user_id) as has_my_review,
    COALESCE(j.translations, '{}'::jsonb) as translations
  FROM bids b
  JOIN jobs j ON j.id = b.job_id
  JOIN profiles p ON p.id = j.poster_id
  LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
  WHERE b.worker_id = p_user_id
    AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
  ORDER BY b.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMIT;

DO $$ 
BEGIN 
    RAISE NOTICE '✅ Universal Translation Feeds deployed successfully.'; 
END $$;
