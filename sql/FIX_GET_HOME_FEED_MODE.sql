-- ============================================================================
-- SQL: FIX_GET_HOME_FEED_MODE (Phase 42)
-- Purpose: Fix get_home_feed to properly respect p_feed_mode ('RECOMMENDED' vs 'ALL')
--          Recommended uses scoring (Skills + Distance + Recency)
--          All (Recent) uses pure chronological or user-selected sort.
-- ============================================================================

BEGIN;

-- 1. DROP Existing Functions (Robust Cleanup)
-- We must drop to handle potential return type or parameter changes
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN);

-- 2. CREATE Updated GET_HOME_FEED
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

    -- 2. Create regex pattern for skills (with basic sanitization for regex characters)
    IF v_user_skills IS NOT NULL AND array_length(v_user_skills, 1) > 0 THEN
        SELECT string_agg(regexp_replace(skill, '([!$()*+.:<=>?[\\\]^{|}-])', '\\\1', 'g'), '|')
        INTO v_skill_pattern
        FROM unnest(v_user_skills) AS skill
        WHERE skill IS NOT NULL AND length(trim(skill)) > 0;
    END IF;

  RETURN QUERY
  SELECT 
    j.id, j.poster_id, p.name as poster_name, p.profile_photo as poster_photo, p.rating as poster_rating,
    j.title, j.description, j.category, j.location, j.latitude, j.longitude,
    j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.image,
    j.created_at,
    (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
    b.id as my_bid_id,
    -- FLAG: Recommend only if matching skills (used for UI badge)
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
    AND (p_category IS NULL OR p_category = '' OR p_category = 'All' OR j.category = p_category)
    AND (p_search_query IS NULL OR p_search_query = '' OR (j.title || j.description) ILIKE '%' || p_search_query || '%')
    AND (p_min_budget IS NULL OR j.budget >= p_min_budget)
    -- Distance Filter (Haversine approx via point type)
    AND (p_max_distance IS NULL OR (
        j.latitude IS NOT NULL AND j.longitude IS NOT NULL AND p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND
        (point(j.longitude, j.latitude) <@> point(p_user_lng, p_user_lat)) <= (p_max_distance / 1.60934) -- Divide by 1.60934 since <@> returns miles
    ))
  ORDER BY 
    -- 1. PRIMARY SORT: RECOMMENDATION MODE (Multi-factor scoring)
    CASE WHEN p_feed_mode = 'RECOMMENDED' THEN
        (
            -- Factor A: Skill Match (Major Boost)
            (CASE WHEN (
                v_user_skills IS NOT NULL AND (
                    j.category = ANY(v_user_skills) OR 
                    (v_skill_pattern IS NOT NULL AND v_skill_pattern <> '' AND (j.title ~* v_skill_pattern OR j.description ~* v_skill_pattern))
                )
            ) THEN 1000 ELSE 0 END) +
            
            -- Factor B: Distance Bonus (Minor Boost - max 100 points)
            COALESCE(
              CASE WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND j.latitude IS NOT NULL THEN
                GREATEST(0, 100 - (point(j.longitude, j.latitude) <@> point(p_user_lng, p_user_lat)) * 5)
              ELSE 0 END, 0
            ) +
            
            -- Factor C: Recency Bonus (Decay scoring)
            EXTRACT(EPOCH FROM j.created_at) / 1000000
        )
    ELSE 0 END DESC,

    -- 2. SECONDARY SORT: User Selected Sort (For ALL mode, or ties in RECOMMENDED)
    CASE WHEN p_sort_by = 'NEAREST' AND p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
       (point(j.longitude, j.latitude) <@> point(p_user_lng, p_user_lat))
    ELSE 0 END ASC,
    
    CASE WHEN p_sort_by = 'BUDGET_HIGH' THEN j.budget END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'BUDGET_LOW' THEN j.budget END ASC NULLS LAST,

    -- 3. FINAL FALLBACK: Newest First
    j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMIT;

SELECT '✅ Feed mode logic fixed!' as status;
