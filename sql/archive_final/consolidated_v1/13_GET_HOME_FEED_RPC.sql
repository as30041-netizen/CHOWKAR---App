-- ============================================================================
-- RPC: GET HOME FEED (Worker Discovery)
-- Efficiently fetches jobs for workers with server-side filtering
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
    status TEXT, -- Cast explicitly if using Enum
    image TEXT,
    created_at TIMESTAMPTZ,
    bid_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
        j.bid_count
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
    ORDER BY j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;
