-- ============================================================================
-- DATA FETCHING OPTIMIZATION - RPC Functions
-- ============================================================================
-- Purpose: Reduce data payload for home feed and enable lazy loading of job details
-- 
-- BACKWARD COMPATIBLE: Does not modify existing tables or functions.
-- These are NEW functions that can be adopted incrementally.
-- ============================================================================

-- ============================================================================
-- 1. get_home_feed - Lightweight feed query
-- ============================================================================
-- Returns job summary data with pre-computed bid counts and current user's bid info
-- This eliminates the need to fetch ALL bids for ALL jobs on the home screen

CREATE OR REPLACE FUNCTION get_home_feed(
    p_user_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_status TEXT DEFAULT NULL,  -- Optional: Filter by status ('OPEN', 'IN_PROGRESS', 'COMPLETED')
    p_exclude_completed BOOLEAN DEFAULT FALSE  -- Optional: Exclude completed jobs from feed
)
RETURNS TABLE (
    id UUID,
    poster_id UUID,
    poster_name TEXT,
    poster_photo TEXT,
    title TEXT,
    description TEXT,  -- Kept for JobCard preview (truncated in UI)
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
    -- Aggregated fields (OPTIMIZATION: computed in DB, not client)
    bid_count BIGINT,
    my_bid_id UUID,
    my_bid_status TEXT,
    my_bid_amount NUMERIC
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
        -- Aggregated bid count (efficient subquery)
        (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id)::BIGINT as bid_count,
        -- My bid info (if exists) - avoids fetching all bids
        (SELECT b.id FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1) as my_bid_id,
        (SELECT b.status FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1) as my_bid_status,
        (SELECT b.amount FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1) as my_bid_amount
    FROM jobs j
    WHERE 
        (p_status IS NULL OR j.status = p_status)
        AND (p_exclude_completed = FALSE OR j.status != 'COMPLETED')
    ORDER BY j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_home_feed TO authenticated;

-- ============================================================================
-- 2. get_job_full_details - On-demand detail loading
-- ============================================================================
-- Fetches complete job data + all bids when user clicks to view details
-- Only called when drilling into a specific job

CREATE OR REPLACE FUNCTION get_job_full_details(p_job_id UUID)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    job_row RECORD;
BEGIN
    -- Fetch the job
    SELECT * INTO job_row FROM jobs WHERE id = p_job_id;
    
    IF job_row.id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Build JSON response with job, all bids, and reviews
    SELECT json_build_object(
        'job', json_build_object(
            'id', job_row.id,
            'poster_id', job_row.poster_id,
            'poster_name', job_row.poster_name,
            'poster_phone', job_row.poster_phone,
            'poster_photo', job_row.poster_photo,
            'title', job_row.title,
            'description', job_row.description,
            'category', job_row.category,
            'location', job_row.location,
            'latitude', job_row.latitude,
            'longitude', job_row.longitude,
            'job_date', job_row.job_date,
            'duration', job_row.duration,
            'budget', job_row.budget,
            'status', job_row.status,
            'created_at', job_row.created_at,
            'accepted_bid_id', job_row.accepted_bid_id,
            'image', job_row.image
        ),
        'bids', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', b.id,
                    'job_id', b.job_id,
                    'worker_id', b.worker_id,
                    'worker_name', b.worker_name,
                    'worker_phone', b.worker_phone,
                    'worker_rating', b.worker_rating,
                    'worker_location', b.worker_location,
                    'worker_latitude', b.worker_latitude,
                    'worker_longitude', b.worker_longitude,
                    'worker_photo', b.worker_photo,
                    'amount', b.amount,
                    'message', b.message,
                    'status', b.status,
                    'negotiation_history', b.negotiation_history,
                    'created_at', b.created_at,
                    'poster_id', b.poster_id
                ) ORDER BY b.created_at DESC
            ), '[]'::json)
            FROM bids b
            WHERE b.job_id = p_job_id
        ),
        'reviews', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', r.id,
                    'reviewerId', r.reviewer_id,
                    'reviewerName', p.name,
                    'revieweeId', r.reviewee_id,
                    'rating', r.rating,
                    'comment', r.comment,
                    'date', EXTRACT(EPOCH FROM r.created_at) * 1000
                )
            ), '[]'::json)
            FROM reviews r
            JOIN profiles p ON r.reviewer_id = p.id
            WHERE r.job_id = p_job_id
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_job_full_details TO authenticated;

-- ============================================================================
-- 3. get_my_jobs_feed - Jobs posted by current user (for "My Jobs" tab)
-- ============================================================================
-- Optimized query for poster's job management view

CREATE OR REPLACE FUNCTION get_my_jobs_feed(
    p_user_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    poster_id UUID,
    poster_name TEXT,
    title TEXT,
    category TEXT,
    location TEXT,
    budget NUMERIC,
    status TEXT,
    created_at TIMESTAMPTZ,
    accepted_bid_id UUID,
    bid_count BIGINT,
    pending_bid_count BIGINT,
    accepted_worker_name TEXT,
    accepted_worker_photo TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT 
        j.id,
        j.poster_id,
        j.poster_name,
        j.title,
        j.category,
        j.location,
        j.budget,
        j.status,
        j.created_at,
        j.accepted_bid_id,
        (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id)::BIGINT as bid_count,
        (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id AND b.status = 'PENDING')::BIGINT as pending_bid_count,
        (SELECT b.worker_name FROM bids b WHERE b.id = j.accepted_bid_id LIMIT 1) as accepted_worker_name,
        (SELECT b.worker_photo FROM bids b WHERE b.id = j.accepted_bid_id LIMIT 1) as accepted_worker_photo
    FROM jobs j
    WHERE j.poster_id = p_user_id
    ORDER BY 
        CASE j.status 
            WHEN 'IN_PROGRESS' THEN 1 
            WHEN 'OPEN' THEN 2 
            ELSE 3 
        END,
        j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_my_jobs_feed TO authenticated;

-- ============================================================================
-- 4. get_my_applications_feed - Jobs where current user has bid (for Workers)
-- ============================================================================
-- Optimized query for worker's "My Applications" view

CREATE OR REPLACE FUNCTION get_my_applications_feed(
    p_user_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    poster_id UUID,
    poster_name TEXT,
    poster_photo TEXT,
    title TEXT,
    category TEXT,
    location TEXT,
    budget NUMERIC,
    job_status TEXT,
    created_at TIMESTAMPTZ,
    accepted_bid_id UUID,
    -- My bid specific info
    my_bid_id UUID,
    my_bid_amount NUMERIC,
    my_bid_status TEXT,
    my_bid_created_at TIMESTAMPTZ,
    is_my_bid_accepted BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT 
        j.id,
        j.poster_id,
        j.poster_name,
        j.poster_photo,
        j.title,
        j.category,
        j.location,
        j.budget,
        j.status as job_status,
        j.created_at,
        j.accepted_bid_id,
        b.id as my_bid_id,
        b.amount as my_bid_amount,
        b.status as my_bid_status,
        b.created_at as my_bid_created_at,
        (j.accepted_bid_id = b.id) as is_my_bid_accepted
    FROM bids b
    JOIN jobs j ON j.id = b.job_id
    WHERE b.worker_id = p_user_id
    ORDER BY 
        CASE 
            WHEN j.accepted_bid_id = b.id AND j.status = 'IN_PROGRESS' THEN 1  -- Active jobs first
            WHEN b.status = 'PENDING' THEN 2  -- Pending bids
            ELSE 3  -- History
        END,
        b.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_my_applications_feed TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to test the functions)
-- ============================================================================
-- 
-- Test get_home_feed:
-- SELECT * FROM get_home_feed('YOUR_USER_UUID', 10, 0);
--
-- Test get_job_full_details:
-- SELECT * FROM get_job_full_details('YOUR_JOB_UUID');
--
-- Test get_my_jobs_feed:
-- SELECT * FROM get_my_jobs_feed('YOUR_USER_UUID', 10, 0);
--
-- Test get_my_applications_feed:
-- SELECT * FROM get_my_applications_feed('YOUR_USER_UUID', 10, 0);
-- ============================================================================
