-- FIX: Ambiguous column reference in get_job_bids
-- The error "column reference \"job_id\" is ambiguous" suggests a conflict in the EXISTS clause.
-- We fix this by aliasing the bids table explicitly.

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
    -- Get Poster ID
    SELECT j.poster_id INTO v_target_poster_id FROM jobs j WHERE j.id = p_job_id;
    
    -- Check if user has a bid (Explicit alias to prevent ambiguity)
    SELECT EXISTS(
        SELECT 1 FROM bids b_check
        WHERE b_check.job_id = p_job_id AND b_check.worker_id = v_current_user_id
    ) INTO v_user_has_bid;
    
    -- Security verification
    IF v_target_poster_id != v_current_user_id AND NOT v_user_has_bid THEN
        RAISE EXCEPTION 'Access Denied: You must be the job poster or have a bid to view bids';
    END IF;

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
