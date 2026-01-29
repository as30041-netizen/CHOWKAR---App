-- ============================================================================
-- SQL: REFINED HOME FEED PERSONALIZATION
-- Purpose: Ensure 'For You' correctly prioritizes user skills and categories.
--          Updates 'get_home_feed' to respect 'p_feed_mode'.
-- ============================================================================

BEGIN;

-- 1. DROP Existing Function (Ensure we have the latest signature)
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC);

-- 2. RE-CREATE: get_home_feed
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
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT, image TEXT,
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

    -- 2. Create regex for skills mapping
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
    j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.image,
    j.created_at,
    (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
    b.id as my_bid_id,
    -- Recommendation Logic (True if matches category or skill pattern)
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
    -- Budget Filter
    AND (p_min_budget IS NULL OR j.budget >= p_min_budget)
    -- Distance Filter (Standard Geospatial)
    AND (p_max_distance IS NULL OR (
        j.latitude IS NOT NULL AND j.longitude IS NOT NULL AND p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND
        (point(j.longitude, j.latitude) <@> point(p_user_lng, p_user_lat)) <= (p_max_distance / 1.60934) 
    ))
  ORDER BY 
    -- 1. Primary Sort: Forced Mode
    CASE WHEN p_feed_mode = 'RECOMMENDED' THEN
        -- Boost recommended if in For You mode
        CASE WHEN (
            v_user_skills IS NOT NULL AND (
                j.category = ANY(v_user_skills) OR 
                (v_skill_pattern IS NOT NULL AND v_skill_pattern <> '' AND (j.title ~* v_skill_pattern OR j.description ~* v_skill_pattern))
            )
        ) THEN 0 ELSE 1 END
    ELSE 0 END ASC,

    -- 2. Secondary Sort: Distance (If NEAREST)
    CASE WHEN p_sort_by = 'NEAREST' AND p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
       (point(j.longitude, j.latitude) <@> point(p_user_lng, p_user_lat))
    ELSE 0 END ASC,

    -- 3. Tertiary Sort: Creation Date (Newest First)
    j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMIT;

DO $$ 
BEGIN 
    RAISE NOTICE '✅ REFINED_HOME_FEED_PERSONALIZATION deployed successfully.'; 
END $$;
