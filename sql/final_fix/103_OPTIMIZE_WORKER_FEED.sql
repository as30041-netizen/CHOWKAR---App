-- ============================================================================
-- OPTIMIZATION: WORKER DISCOVERY FEED (Performance + Separation)
-- Purpose:
-- 1. Ensure absolute separation: Workers never see their own jobs or jobs they applied to.
-- 2. Performance: Push filter logic (Skills, Location) into the main query to utilize indexes and LIMIT early.
-- 3. Relevance: Prioritize strict matches for "Recommended" mode, fallback to recency.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION get_home_feed(
  p_user_id UUID, 
  p_limit INTEGER DEFAULT 20, 
  p_offset INTEGER DEFAULT 0, 
  p_category TEXT DEFAULT NULL, 
  p_search_query TEXT DEFAULT NULL,
  p_feed_mode TEXT DEFAULT 'RECOMMENDED', -- 'RECOMMENDED' or 'ALL'
  p_sort_by TEXT DEFAULT 'NEWEST',        -- 'NEWEST', 'NEAREST', 'BUDGET_HIGH', 'BUDGET_LOW'
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
    -- 1. Fetch User Skills (Only needed for RECOMMENDED mode)
    IF p_feed_mode = 'RECOMMENDED' THEN
        SELECT skills INTO v_user_skills FROM profiles p_prof WHERE p_prof.id = p_user_id;
        
        -- Create regex pattern for flexible matching
        IF v_user_skills IS NOT NULL THEN
            SELECT string_agg(
                regexp_replace(
                    LEFT(skill, GREATEST(4, length(skill) - 3)), 
                    '([!$()*+.:<=>?[\\\]^{|}-])', '\\\1', 'g'
                ), 
                '|'
            )
            INTO v_skill_pattern
            FROM unnest(v_user_skills) AS skill
            WHERE skill IS NOT NULL AND length(skill) > 0;
        END IF;
    END IF;

    RETURN QUERY
    SELECT 
        j.id, j.poster_id, p.name as poster_name, p.profile_photo as poster_photo, p.rating as poster_rating,
        j.title, j.description, j.category, j.location, j.latitude, j.longitude,
        j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.image,
        j.created_at,
        (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
        NULL::UUID as my_bid_id, -- Optimization: We filter out bid jobs, so this is always NULL
        
        -- Recommendation Flag (Computed on fly)
        (
            p_feed_mode = 'RECOMMENDED' AND v_user_skills IS NOT NULL AND (
                j.category = ANY(v_user_skills) OR 
                (v_skill_pattern IS NOT NULL AND v_skill_pattern <> '' AND (j.title ~* v_skill_pattern OR j.description ~* v_skill_pattern))
            )
        ) AS is_recommended,

        COALESCE(j.translations, '{}'::jsonb) as translations
    FROM jobs j
    JOIN profiles p ON p.id = j.poster_id
    LEFT JOIN user_job_visibility vis ON vis.job_id = j.id AND vis.user_id = p_user_id
    WHERE j.status = 'OPEN' 
      AND j.poster_id != p_user_id -- Strict Separation: Don't show my own jobs
      
      -- separation: Exclude jobs I already bid on (Worker "Find" Feed)
      AND NOT EXISTS (SELECT 1 FROM bids b2 WHERE b2.job_id = j.id AND b2.worker_id = p_user_id)
      
      -- Privacy: Exclude hidden jobs
      AND (vis.is_hidden IS NULL OR vis.is_hidden = FALSE)
      
      -- Standard Filters
      AND (p_category IS NULL OR j.category = p_category)
      AND (p_search_query IS NULL OR (j.title || ' ' || j.description) ILIKE '%' || p_search_query || '%')
      AND (p_min_budget IS NULL OR j.budget >= p_min_budget)
      
      -- Distance Filter (Optimized early check)
      AND (p_max_distance IS NULL OR (
          j.latitude IS NOT NULL AND j.longitude IS NOT NULL AND p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND
          (point(j.longitude, j.latitude) <@> point(p_user_lng, p_user_lat)) <= (p_max_distance / 1.60934) 
      ))

      -- Mode-Specific Filters (Push Down Predicate)
      AND (
          p_feed_mode != 'RECOMMENDED' OR 
          p_category IS NOT NULL OR       -- If filtering by category, ignore recommendation constraint
          p_search_query IS NOT NULL OR   -- If searching, ignore recommendation constraint
          (
             -- "For You" Logic: Must match skills OR be very new (last 2 hours) to avoid empty feed
             v_user_skills IS NULL OR 
             j.category = ANY(v_user_skills) OR 
             (v_skill_pattern IS NOT NULL AND (j.title ~* v_skill_pattern OR j.description ~* v_skill_pattern)) OR
             j.created_at > (NOW() - INTERVAL '2 hours') -- Retention fallback
          )
      )
    ORDER BY 
      -- Sort Logic
      CASE WHEN p_sort_by = 'NEAREST' AND p_user_lat IS NOT NULL THEN
         (point(j.longitude, j.latitude) <@> point(p_user_lng, p_user_lat))
      WHEN p_sort_by = 'BUDGET_HIGH' THEN -j.budget
      WHEN p_sort_by = 'BUDGET_LOW' THEN j.budget
      ELSE 0 END ASC,
      
      -- Secondary Sort: Recommendations First (if default sort)
      CASE WHEN p_sort_by = 'NEWEST' AND p_feed_mode = 'RECOMMENDED' AND (
          v_user_skills IS NOT NULL AND (j.category = ANY(v_user_skills))
      ) THEN 0 ELSE 1 END ASC,
      
      j.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMIT;
