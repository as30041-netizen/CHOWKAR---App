-- ==========================================
-- FIX: BIDDING WORKER NULL CONSTRAINT
-- Purpose: 
-- 1. Fix 'null value in column "worker_name"' error by fetching worker details
-- 2. Populate denormalized fields (name, phone, photo, location) from profiles
-- ==========================================

BEGIN;

-- Drop first to avoid return type conflicts
DROP FUNCTION IF EXISTS public.action_place_bid(uuid, integer, text);

CREATE OR REPLACE FUNCTION public.action_place_bid(
    p_job_id UUID,
    p_amount INTEGER,
    p_message TEXT DEFAULT NULL
)
RETURNS JSON 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_job_status TEXT;
    v_job_poster_id UUID;
    v_job_title TEXT;
    v_new_bid_id UUID;
    v_worker_id UUID := auth.uid();
    v_worker_record RECORD;
BEGIN
    -- 1. Validation: Basic Info
    SELECT status, poster_id, title INTO v_job_status, v_job_poster_id, v_job_title 
    FROM public.jobs WHERE id = p_job_id;
    
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job is no longer open for bidding'); END IF;
    IF v_job_poster_id = v_worker_id THEN RETURN json_build_object('success', false, 'error', 'You cannot bid on your own job'); END IF;
    
    -- 2. Duplicate Check
    IF EXISTS (SELECT 1 FROM public.bids WHERE job_id = p_job_id AND worker_id = v_worker_id) THEN
        RETURN json_build_object('success', false, 'error', 'You have already placed a bid on this job');
    END IF;

    -- 3. Fetch Worker Details (REQUIRED for denormalized columns)
    SELECT * INTO v_worker_record FROM public.profiles WHERE id = v_worker_id;

    IF v_worker_record.name IS NULL THEN
         RETURN json_build_object('success', false, 'error', 'Please complete your profile (Name is required) before bidding.');
    END IF;

    -- 4. Insert Bid 
    -- We MUST include worker_name, worker_phone, worker_photo, worker_location
    -- as the schema apparently enforces NOT NULL on some of these.
    INSERT INTO public.bids (
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
        worker_longitude,
        negotiation_history,
        created_at, 
        updated_at
    )
    VALUES (
        p_job_id, 
        v_worker_id, 
        p_amount, 
        p_message, 
        'PENDING', 
        COALESCE(v_worker_record.name, 'Unknown Worker'),
        COALESCE(v_worker_record.phone, ''),
        v_worker_record.profile_photo,
        COALESCE(v_worker_record.location, ''),
        COALESCE(v_worker_record.rating, 0),
        v_worker_record.latitude,
        v_worker_record.longitude,
        jsonb_build_array(jsonb_build_object(
            'amount', p_amount, 
            'by', 'WORKER', 
            'at', extract(epoch from now()) * 1000,
            'message', p_message
        )),
        NOW(), 
        NOW()
    )
    RETURNING id INTO v_new_bid_id;

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id);
END;
$$;

COMMIT;
