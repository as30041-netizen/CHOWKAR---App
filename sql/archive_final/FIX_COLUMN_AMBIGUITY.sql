-- ============================================================================
-- FIX AMBIGUOUS COLUMN REFERENCES
-- Run this to fix the "column reference is ambiguous" errors
-- ============================================================================

-- Fix get_home_feed - fully qualify all column references
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
    poster_phone TEXT,
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
        p.phone AS poster_phone,
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
        COALESCE((SELECT COUNT(*)::INTEGER FROM bids b2 WHERE b2.job_id = j.id), 0) AS bid_count
    FROM jobs j
    JOIN profiles p ON j.poster_id = p.id
    LEFT JOIN user_job_visibility ujv ON ujv.job_id = j.id AND ujv.user_id = p_user_id
    WHERE 
        j.status = 'OPEN'
        AND j.poster_id != p_user_id
        AND NOT EXISTS (
            SELECT 1 FROM bids b 
            WHERE b.job_id = j.id 
            AND b.worker_id = p_user_id
        )
        AND (ujv.is_hidden IS NULL OR ujv.is_hidden = FALSE)
        AND (p_category IS NULL OR p_category = '' OR j.category = p_category)
        AND (p_search_query IS NULL OR p_search_query = '' OR (
            j.title ILIKE '%' || p_search_query || '%' OR 
            j.description ILIKE '%' || p_search_query || '%'
        ))
    ORDER BY j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Fix get_job_bids - fully qualify all column references
CREATE OR REPLACE FUNCTION get_job_bids(p_job_id UUID)
RETURNS TABLE (
    id UUID,
    job_id UUID,
    worker_id UUID,
    worker_name TEXT,
    worker_phone TEXT,
    worker_rating NUMERIC,
    worker_location TEXT,
    worker_latitude NUMERIC,
    worker_longitude NUMERIC,
    worker_photo TEXT,
    amount INTEGER,
    message TEXT,
    status TEXT,
    negotiation_history JSONB,
    created_at TIMESTAMPTZ,
    poster_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_poster_id UUID;
    v_current_user_id UUID := auth.uid();
    v_user_has_bid BOOLEAN;
BEGIN
    -- Get the job poster ID
    SELECT j.poster_id INTO v_target_poster_id 
    FROM jobs j 
    WHERE j.id = p_job_id;
    
    -- Check if current user has a bid on this job (FIXED: fully qualified columns)
    SELECT EXISTS(
        SELECT 1 FROM bids b 
        WHERE b.job_id = p_job_id 
        AND b.worker_id = v_current_user_id
    ) INTO v_user_has_bid;
    
    -- FIXED Security: Allow if user is EITHER the poster OR has a bid
    IF v_target_poster_id != v_current_user_id AND NOT v_user_has_bid THEN
        RAISE EXCEPTION 'Access Denied: You must be the job poster or have a bid to view bids';
    END IF;

    -- Return bids (FIXED: fully qualified columns)
    RETURN QUERY 
    SELECT 
        b.id,
        b.job_id,
        b.worker_id,
        COALESCE(p.name, 'Unknown Worker') as worker_name,
        p.phone as worker_phone,
        p.rating as worker_rating,
        p.location as worker_location,
        p.latitude as worker_latitude,
        p.longitude as worker_longitude,
        p.profile_photo as worker_photo,
        b.amount,
        b.message,
        b.status::TEXT,
        b.negotiation_history,
        b.created_at,
        v_target_poster_id AS poster_id
    FROM bids b
    LEFT JOIN profiles p ON b.worker_id = p.id
    WHERE b.job_id = p_job_id
    ORDER BY b.created_at DESC;
END;
$$;

-- Verify fixes
SELECT 'Column ambiguity fixed! Test your app now.' AS status;
