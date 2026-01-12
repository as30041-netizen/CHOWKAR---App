-- ============================================
-- FIX PLACE BID V16 (COMPATIBILITY MODE)
-- 1. Remove poster_id from insert (if it doesn't exist)
-- 2. Add column existence checks
-- 3. Robust worker data fetching
-- ============================================

CREATE OR REPLACE FUNCTION action_place_bid(
    p_job_id UUID,
    p_amount INTEGER,
    p_message TEXT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_job_status TEXT;
    v_job_poster_id UUID;
    v_job_title TEXT;
    v_new_bid_id UUID;
    v_worker RECORD;
    v_has_poster_col BOOLEAN;
    v_has_neg_col BOOLEAN;
BEGIN
    -- 1. Basic Validations
    SELECT status, poster_id, title INTO v_job_status, v_job_poster_id, v_job_title FROM jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job closed'); END IF;
    IF v_job_poster_id = auth.uid() THEN RETURN json_build_object('success', false, 'error', 'Cannot bid on own job'); END IF;
    
    IF EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id AND worker_id = auth.uid()) THEN
        RETURN json_build_object('success', false, 'error', 'You have already placed a bid on this job');
    END IF;

    -- 2. Fetch worker info
    SELECT * INTO v_worker FROM profiles WHERE id = auth.uid();
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Profile not found. Please complete your profile first.'); END IF;

    -- 3. Dynamic Column Check
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bids' AND column_name = 'poster_id') INTO v_has_poster_col;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bids' AND column_name = 'negotiation_history') INTO v_has_neg_col;

    -- 4. Execution
    -- We use dynamic SQL to avoid compilation errors if columns are missing
    EXECUTE format('
        INSERT INTO bids (
            job_id, worker_id, amount, message, status, 
            worker_name, worker_phone, worker_photo, worker_location, 
            worker_rating, worker_latitude, worker_longitude,
            created_at, updated_at
            %s %s
        )
        VALUES (
            $1, $2, $3, $4, ''PENDING'',
            $5, $6, $7, $8,
            $9, $10, $11,
            NOW(), NOW()
            %s %s
        )
        RETURNING id',
        CASE WHEN v_has_poster_col THEN ', poster_id' ELSE '' END,
        CASE WHEN v_has_neg_col THEN ', negotiation_history' ELSE '' END,
        CASE WHEN v_has_poster_col THEN ', $12' ELSE '' END,
        CASE WHEN v_has_neg_col THEN ', $13' ELSE '' END
    )
    INTO v_new_bid_id
    USING 
        p_job_id, auth.uid(), p_amount, p_message,
        COALESCE(v_worker.name, 'Worker'), v_worker.phone, v_worker.profile_photo, v_worker.location,
        COALESCE(v_worker.rating, 5), v_worker.latitude, v_worker.longitude,
        v_job_poster_id,
        jsonb_build_array(jsonb_build_object('amount', p_amount, 'by', 'worker', 'timestamp', extract(epoch from now())*1000));

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id);
END;
$$;

DO $$ BEGIN
  RAISE NOTICE '✅ V16 Compatibility Fix Deployed.';
END $$;
