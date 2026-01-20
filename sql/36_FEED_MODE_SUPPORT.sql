-- ============================================================================
-- RPC: FEED_MODE_SUPPORT
-- Updates get_home_feed to support 'RECOMMENDED' vs 'ALL' (Recent) modes
-- ============================================================================

-- DROP first to allow parameter addition
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_home_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_category TEXT DEFAULT NULL,
    p_search_query TEXT DEFAULT NULL,
    p_feed_mode TEXT DEFAULT 'RECOMMENDED'
)
RETURNS TABLE (
    id UUID,
    poster_id UUID,
    poster_name TEXT,
    poster_photo TEXT,
    title TEXT,
    description TEXT,
    category TEXT,
    location TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    job_date TIMESTAMPTZ,
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
    -- 1. Fetch User Skills
    SELECT skills INTO v_user_skills
    FROM profiles
    WHERE id = p_user_id;

    -- 2. Create a regex pattern like 'Skill1|Skill2' for text search
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
        j.title,
        j.description,
        j.category,
        j.location,
        j.latitude,
        j.longitude,
        j.job_date,
        j.duration,
        j.budget,
        j.status::TEXT,
        j.image,
        j.created_at,
        j.bid_count,
        -- LOGIC: 
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
        AND (p_category IS NULL OR p_category = '' OR p_category = 'All' OR j.category = p_category)
        AND (p_search_query IS NULL OR p_search_query = '' OR (
            j.title ILIKE '%' || p_search_query || '%' OR 
            j.description ILIKE '%' || p_search_query || '%'
        ))
    ORDER BY 
        -- BOOSTING: Only if mode is RECOMMENDED
        CASE 
            WHEN p_feed_mode = 'RECOMMENDED' THEN 
                (CASE WHEN (
                    v_user_skills IS NOT NULL AND (
                        j.category = ANY(v_user_skills) OR 
                        (v_skill_pattern IS NOT NULL AND v_skill_pattern <> '' AND (j.title ~* v_skill_pattern OR j.description ~* v_skill_pattern))
                    )
                ) THEN 0 ELSE 1 END)
            ELSE 0 
        END ASC,
        j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_home_feed TO authenticated;
