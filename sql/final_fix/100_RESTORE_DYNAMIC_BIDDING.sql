-- ============================================================================
-- FIX: DYNAMIC BIDDING (SAFE FOR ALL SCHEMAS)
-- Purpose: 
-- 1. Restore the 'dynamic' nature of the bid script to handle schema variations.
-- 2. Specifically checks for 'poster_id' column (which existed in some versions).
-- 3. Keeps wallet logic REMOVED.
-- 4. Keeps worker details (name/phone/photo) ADDED (fixes NULL error).
-- ============================================================================

BEGIN;

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
    v_has_poster_col BOOLEAN;
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

    -- 3. Fetch Worker Details (Fixes NULL error)
    SELECT * INTO v_worker_record FROM public.profiles WHERE id = v_worker_id;

    IF v_worker_record.name IS NULL THEN
         RETURN json_build_object('success', false, 'error', 'Please complete your profile (Name is required) before bidding.');
    END IF;

    -- 4. Check for Optional 'poster_id' column (Restoring Robustness)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bids' AND column_name = 'poster_id'
    ) INTO v_has_poster_col;

    -- 5. Insert Bid (Dynamic Execution)
    EXECUTE format('
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
            %s -- Optional poster_id column
        )
        VALUES (
            $1, $2, $3, $4, ''PENDING'',
            $5, $6, $7, $8, $9, $10, $11,
            $12,
            NOW(), NOW()
            %s -- Optional poster_id value
        )
        RETURNING id',
        CASE WHEN v_has_poster_col THEN ', poster_id' ELSE '' END,
        CASE WHEN v_has_poster_col THEN ', $13' ELSE '' END
    )
    INTO v_new_bid_id
    USING 
        p_job_id,                               -- $1
        v_worker_id,                            -- $2
        p_amount,                               -- $3
        p_message,                              -- $4
        COALESCE(v_worker_record.name, 'Worker'), -- $5
        COALESCE(v_worker_record.phone, ''),      -- $6
        v_worker_record.profile_photo,            -- $7
        COALESCE(v_worker_record.location, ''),   -- $8
        COALESCE(v_worker_record.rating, 0),      -- $9
        v_worker_record.latitude,                 -- $10
        v_worker_record.longitude,                -- $11
        jsonb_build_array(jsonb_build_object(     -- $12
            'amount', p_amount, 
            'by', 'WORKER', 
            'at', extract(epoch from now()) * 1000,
            'message', p_message
        )),
        v_job_poster_id                           -- $13 (Only used if column exists)
    ;

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id);
END;
$$;

COMMIT;
