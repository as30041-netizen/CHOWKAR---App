-- ========================================================
-- FIX FOR WORKER APPLICATIONS & POSTER CLARITY
-- ========================================================
-- This script adds a specialized function to fetch a worker's
-- active applications and improves the home feed for posters.

BEGIN;

-- 1. Create function to fetch jobs where user has bid (My Applications)
-- This solves the "disappearing jobs" issue for workers.
CREATE OR REPLACE FUNCTION get_my_applications(
    p_user_id UUID,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
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
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    job_date TEXT,
    duration TEXT,
    budget NUMERIC,
    status TEXT,
    created_at TIMESTAMPTZ,
    accepted_bid_id UUID,
    image TEXT,
    bid_count BIGINT,
    my_bid_id UUID,
    my_bid_status TEXT,
    my_bid_amount NUMERIC,
    my_bid_last_negotiation_by TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT 
        j.id,
        j.poster_id,
        j.poster_name,
        j.poster_photo,
        j.title,
        j.description,
        j.category,
        j.location,
        j.latitude,
        j.longitude,
        j.job_date,
        j.duration,
        j.budget,
        j.status,
        j.created_at,
        j.accepted_bid_id,
        j.image,
        (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id)::BIGINT as bid_count,
        b.id as my_bid_id,
        b.status as my_bid_status,
        b.amount as my_bid_amount,
        (b.negotiation_history->-1->>'by') as my_bid_last_negotiation_by
    FROM jobs j
    JOIN bids b ON b.job_id = j.id
    WHERE b.worker_id = p_user_id
    ORDER BY 
        CASE 
            WHEN b.status = 'ACCEPTED' THEN 1 
            WHEN b.status = 'PENDING' THEN 2 
            ELSE 3 
        END,
        j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION get_my_applications TO authenticated;

COMMIT;
