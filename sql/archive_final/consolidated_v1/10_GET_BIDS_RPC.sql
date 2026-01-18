-- ============================================================================
-- SECURE BIDS FETCHER RPC (FINAL_SECURE)
-- 1. Uses LEFT JOIN (Prevents hidden bids from deleted users)
-- 2. Uses TEXT status (Prevents enum errors)
-- 3. Security Check ENABLED (Prevents unauthorized access)
-- 4. Debug Error: If access denied, raises exception with IDs for debugging
-- ============================================================================

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
BEGIN
    -- 1. Get Poster ID with STRICT alias
    SELECT j.poster_id INTO v_target_poster_id 
    FROM jobs j 
    WHERE j.id = p_job_id;
    
    -- 2. Security Check (ENABLED)
    -- If IDs don't match, we raise an error to see exactly what happened
    IF v_target_poster_id IS DISTINCT FROM v_current_user_id THEN
        RAISE EXCEPTION 'Access Denied: Job Poster % does not match User %', v_target_poster_id, v_current_user_id;
    END IF;

    -- 3. Return Bids
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
    -- AND b.status::TEXT != 'REJECTED' -- Uncomment if you want to hide rejected
    ORDER BY b.created_at DESC;
END;
$$;
