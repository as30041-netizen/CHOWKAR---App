-- ============================================================================
-- SQL: FIX 400 BAD REQUEST TYPO (Phase 51.2)
-- Purpose: Resolve "column fj.job_date does not exist" error.
--          Corrects column alias from fj.job_date to fj.j_date.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC);

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
    -- 1. Fetch User Skills
    SELECT skills INTO v_user_skills FROM profiles p_prof WHERE p_prof.id = p_user_id;

    -- 2. Create flexible regex matching stems
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

  RETURN QUERY
  WITH filtered_jobs AS (
      SELECT 
        j.id as job_id, j.poster_id as j_poster_id, j.title as j_title, j.description as j_desc, 
        j.category as j_cat, j.location as j_loc, j.latitude as j_lat, j.longitude as j_lng, 
        j.job_date as j_date, j.duration as j_dur, j.budget as j_bud, j.status as j_stat, 
        j.image as j_img, j.created_at as j_created, j.translations as j_trans,
        p.name as p_name, p.profile_photo as p_photo, p.rating as p_rating,
        (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as b_count,
        (SELECT b.id FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1) as b_id,
        -- Recommendation Logic
        (
            v_user_skills IS NOT NULL AND (
                j.category = ANY(v_user_skills) OR 
                (v_skill_pattern IS NOT NULL AND v_skill_pattern <> '' AND (j.title ~* v_skill_pattern OR j.description ~* v_skill_pattern))
            )
        ) AS is_rec
      FROM jobs j
      JOIN profiles p ON p.id = j.poster_id
      LEFT JOIN user_job_visibility vis ON vis.job_id = j.id AND vis.user_id = p_user_id
      WHERE j.status = 'OPEN' 
        AND j.poster_id != p_user_id
        -- Exclude already bid
        AND NOT EXISTS (SELECT 1 FROM bids b2 WHERE b2.job_id = j.id AND b2.worker_id = p_user_id)
        AND (vis.is_hidden IS NULL OR vis.is_hidden = FALSE)
        AND (p_category IS NULL OR j.category = p_category)
        AND (p_search_query IS NULL OR (j.title || j.description) ILIKE '%' || p_search_query || '%')
        AND (p_min_budget IS NULL OR j.budget >= p_min_budget)
        -- Distance Filter
        AND (p_max_distance IS NULL OR (
            j.latitude IS NOT NULL AND j.longitude IS NOT NULL AND p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND
            (point(j.longitude, j.latitude) <@> point(p_user_lng, p_user_lat)) <= (p_max_distance / 1.60934) 
        ))
  )
  SELECT 
    fj.job_id, fj.j_poster_id, fj.p_name, fj.p_photo, fj.p_rating,
    fj.j_title, fj.j_desc, fj.j_cat, fj.j_loc, fj.j_lat, fj.j_lng,
    fj.j_date::TIMESTAMPTZ, fj.j_dur, fj.j_bud, UPPER(fj.j_stat::TEXT) as status, fj.j_img,
    fj.j_created,
    fj.b_count,
    fj.b_id,
    fj.is_rec,
    COALESCE(fj.j_trans, '{}'::jsonb) as translations
  FROM filtered_jobs fj
  WHERE 
    -- MODIFIED FILTER: 
    -- 1. If we are in 'ALL' mode, show everything
    -- 2. If a specific category or search is active, show everything (override recommendation lock)
    -- 3. ONLY if in RECOMMENDED mode AND no filters are set, enforce skill matching
    (p_feed_mode != 'RECOMMENDED') OR 
    (p_category IS NOT NULL) OR 
    (p_search_query IS NOT NULL) OR 
    (fj.is_rec = TRUE)
  ORDER BY 
    CASE WHEN p_sort_by = 'NEAREST' AND p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
       (point(fj.j_lng, fj.j_lat) <@> point(p_user_lng, p_user_lat))
    ELSE 0 END ASC,
    fj.j_created DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMIT;
