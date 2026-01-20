-- ============================================================================
-- RPC: DEEP_FEED_FILTERING
-- Updates get_home_feed to support server-side Sort, Budget, and Radius filters
-- ============================================================================

-- DROP first to allow return type/param changes
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT);
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
    id UUID,
    poster_id UUID,
    poster_name TEXT,
    poster_photo TEXT,
    poster_rating NUMERIC, -- Added for consistency
    title TEXT,
    description TEXT,
    category TEXT,
    location TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    job_date DATE, -- CHANGED TO DATE TO MATCH TABLE
    duration TEXT,
    budget INTEGER,
    status TEXT,
    image TEXT,
    created_at TIMESTAMPTZ,
    bid_count INTEGER,
    is_recommended BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_skills TEXT[];
    v_skill_pattern TEXT;
BEGIN
    -- 1. Fetch User Skills for personalization
    SELECT skills INTO v_user_skills
    FROM profiles
    WHERE profiles.id = p_user_id; -- Explicit table alias to avoid ambiguity

    -- 2. Create a regex pattern for skill matching
    IF v_user_skills IS NOT NULL THEN
        SELECT string_agg(regexp_replace(skill, '([!$()*+.:<=>?[\\\]^{|}-])', '\\\1', 'g'), '|')
        INTO v_skill_pattern
        FROM unnest(v_user_skills) AS skill
        WHERE skill IS NOT NULL AND length(skill) > 0;
    END IF;

    RETURN QUERY
    SELECT 
        j.id,
        j.poster_id,
        p.name AS poster_name,
        p.profile_photo AS poster_photo,
        COALESCE(p.rating, 0.0)::NUMERIC AS poster_rating,
        j.title,
        j.description,
        j.category,
        j.location,
        j.latitude,
        j.longitude,
        j.job_date, -- No cast needed, matches DATE return type
        j.duration,
        j.budget,
        j.status::TEXT,
        j.image,
        j.created_at,
        j.bid_count,
        -- LOGIC: Recommendation Flag
        (
            v_user_skills IS NOT NULL AND (
                j.category = ANY(v_user_skills) OR 
                (v_skill_pattern IS NOT NULL AND v_skill_pattern <> '' AND (j.title ~* v_skill_pattern OR j.description ~* v_skill_pattern))
            )
        ) AS is_recommended
    FROM jobs j
    JOIN profiles p ON j.poster_id = p.id
    WHERE 
        j.status = 'OPEN'
        AND j.poster_id != p_user_id 
        AND NOT EXISTS ( 
            SELECT 1 FROM bids b 
            WHERE b.job_id = j.id 
            AND b.worker_id = p_user_id
        )
        -- FILTERS
        AND (p_category IS NULL OR p_category = '' OR p_category = 'All' OR j.category = p_category)
        AND (p_search_query IS NULL OR p_search_query = '' OR (
            j.title ILIKE '%' || p_search_query || '%' OR 
            j.description ILIKE '%' || p_search_query || '%'
        ))
        AND (p_min_budget IS NULL OR j.budget >= p_min_budget)
        -- Distance Filter (Haversine approx if user coords provided)
        AND (
            p_max_distance IS NULL OR (p_user_lat IS NULL OR p_user_lng IS NULL) OR
            (6371 * acos(
                cos(radians(p_user_lat)) * cos(radians(j.latitude)) * 
                cos(radians(j.longitude) - radians(p_user_lng)) + 
                sin(radians(p_user_lat)) * sin(radians(j.latitude))
            )) <= p_max_distance
        )
    ORDER BY 
        -- 1. RECOMMENDATION MODE LOGIC
        CASE 
            WHEN p_feed_mode = 'RECOMMENDED' THEN 
                (
                    -- Base Score: Higher is better
                    (CASE WHEN (
                        v_user_skills IS NOT NULL AND (
                            j.category = ANY(v_user_skills) OR 
                            (v_skill_pattern IS NOT NULL AND v_skill_pattern <> '' AND (j.title ~* v_skill_pattern OR j.description ~* v_skill_pattern))
                        )
                    ) THEN 100 ELSE 0 END) +
                    -- Proximity Score: 0-50 points (max bonus at 0km, 0 at 50km+)
                    COALESCE(
                        CASE 
                            WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
                                GREATEST(0, 50 - (6371 * acos(
                                    cos(radians(p_user_lat)) * cos(radians(j.latitude)) * 
                                    cos(radians(j.longitude) - radians(p_user_lng)) + 
                                    sin(radians(p_user_lat)) * sin(radians(j.latitude))
                                ))) 
                            ELSE 0 
                        END, 0
                    ) +
                    -- Recency Score: 0-20 points (newer jobs get more points)
                    EXTRACT(EPOCH FROM (j.created_at - (NOW() - INTERVAL '7 days'))) / 30240 -- Normalized over 1 week
                )
            ELSE 0 
        END DESC NULLS LAST,
        
        -- 2. DYNAMIC SORTING (Secondary for Recommended, Primary for ALL)
        CASE WHEN p_sort_by = 'BUDGET_HIGH' THEN j.budget END DESC NULLS LAST,
        CASE WHEN p_sort_by = 'BUDGET_LOW' THEN j.budget END ASC NULLS LAST,
        CASE 
            WHEN p_sort_by = 'NEAREST' AND p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN 
                (6371 * acos(
                    cos(radians(p_user_lat)) * cos(radians(j.latitude)) * 
                    cos(radians(j.longitude) - radians(p_user_lng)) + 
                    sin(radians(p_user_lat)) * sin(radians(j.latitude))
                ))
        END ASC NULLS LAST,
        j.created_at DESC -- Final Fallback
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_home_feed TO authenticated;
