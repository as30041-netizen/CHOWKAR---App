-- ============================================================================
-- RPC: GET HOME FEED ENHANCED (Personalization)
-- Updates the feed to boost jobs matching user skills
-- And returns `is_recommended` flag
-- ============================================================================

CREATE OR REPLACE FUNCTION get_home_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_category TEXT DEFAULT NULL,
    p_search_query TEXT DEFAULT NULL
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
    is_recommended BOOLEAN -- NEW: Recommendations Flag
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_skills TEXT[];
BEGIN
    -- 1. Fetch User Skills
    SELECT skills INTO v_user_skills
    FROM profiles
    WHERE id = p_user_id;

    -- 2. Return Query with Boosting Logic
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
        -- Calculate is_recommended: True if job category is in user skills
        (v_user_skills IS NOT NULL AND j.category = ANY(v_user_skills)) AS is_recommended
    FROM jobs j
    JOIN profiles p ON j.poster_id = p.id
    WHERE 
        j.status = 'OPEN'
        AND j.poster_id != p_user_id -- Exclude own jobs
        AND NOT EXISTS ( -- Exclude jobs already bid on
            SELECT 1 FROM bids b 
            WHERE b.job_id = j.id 
            AND b.worker_id = p_user_id
        )
        AND (p_category IS NULL OR j.category = p_category)
        AND (p_search_query IS NULL OR (
            j.title ILIKE '%' || p_search_query || '%' OR 
            j.description ILIKE '%' || p_search_query || '%'
        ))
    ORDER BY 
        -- BOOSTING LOGIC: Recommended jobs come first
        CASE WHEN (v_user_skills IS NOT NULL AND j.category = ANY(v_user_skills)) THEN 0 ELSE 1 END ASC,
        j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;
