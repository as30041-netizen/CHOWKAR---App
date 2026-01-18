-- FIX: Remove poster_id from bids insertion since that column doesn't exist
-- The poster_id can be looked up from the jobs table if needed

CREATE OR REPLACE FUNCTION action_place_bid(
    p_job_id UUID,
    p_amount INTEGER,
    p_message TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS to ensure we can check job status safely
SET search_path = public
AS $$
DECLARE
    v_job_status TEXT;
    v_poster_id UUID;
    v_new_bid_id UUID;
    v_worker_id UUID := auth.uid();
    
    -- Worker Metadata for Denormalization
    v_worker_name TEXT;
    v_worker_phone TEXT;
    v_worker_photo TEXT;
    v_worker_location TEXT;
    v_worker_rating NUMERIC;
    v_worker_lat DOUBLE PRECISION;
    v_worker_lng DOUBLE PRECISION;
BEGIN
    -- 1. Validation: Amount
    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Bid amount must be greater than 0');
    END IF;

    -- 2. Validation: Job Exists & Open
    SELECT status, poster_id INTO v_job_status, v_poster_id FROM jobs WHERE id = p_job_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Job not found');
    END IF;

    IF v_job_status != 'OPEN' THEN
        RETURN json_build_object('success', false, 'error', 'Job is no longer open for bidding');
    END IF;

    IF v_poster_id = v_worker_id THEN
        RETURN json_build_object('success', false, 'error', 'You cannot bid on your own job');
    END IF;

    -- 3. Validation: Duplicate Bid
    IF EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id AND worker_id = v_worker_id) THEN
        RETURN json_build_object('success', false, 'error', 'You have already placed a bid on this job');
    END IF;

    -- 4. Fetch Worker Profile details to denormalize into bids table
    -- This ensures the Home Feed stays fast without expensive joins
    SELECT 
        name, phone, profile_photo, location, rating, latitude, longitude 
    INTO 
        v_worker_name, v_worker_phone, v_worker_photo, v_worker_location, v_worker_rating, v_worker_lat, v_worker_lng
    FROM profiles 
    WHERE id = v_worker_id;

    -- Fallback for name if profile is somehow incomplete
    v_worker_name := COALESCE(v_worker_name, 'Worker');

    -- 5. Execution: Insert Bid (WITHOUT poster_id column - it doesn't exist in bids table)
    INSERT INTO bids (
        job_id, 
        worker_id, 
        amount, 
        message, 
        status, 
        worker_name, 
        worker_phone, 
        worker_photo, 
        worker_location, 
        worker_rating, 
        worker_latitude, 
        worker_longitude
    )
    VALUES (
        p_job_id, 
        v_worker_id, 
        p_amount, 
        p_message, 
        'PENDING', 
        v_worker_name, 
        v_worker_phone, 
        v_worker_photo, 
        v_worker_location, 
        COALESCE(v_worker_rating, 0), 
        v_worker_lat, 
        v_worker_lng
    )
    RETURNING id INTO v_new_bid_id;

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id);
END;
$$;

GRANT EXECUTE ON FUNCTION action_place_bid(UUID, INTEGER, TEXT) TO authenticated;
