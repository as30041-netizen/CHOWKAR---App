-- ============================================
-- FIX ACCEPT BID ISSUES
-- 1. Update job budget with accepted bid amount
-- 2. Ensure rejected workers get notifications
-- ============================================

-- Update the action_accept_bid function
CREATE OR REPLACE FUNCTION action_accept_bid(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_id UUID;
    v_poster_id UUID;
    v_worker_id UUID;
    v_bid_status TEXT;
    v_job_status TEXT;
    v_bid_amount INTEGER;
    v_current_user UUID := auth.uid();
    v_rejected_bid RECORD;
BEGIN
    -- 1. Fetch Context including bid amount
    SELECT b.job_id, b.status, j.poster_id, j.status, b.worker_id, b.amount
    INTO v_job_id, v_bid_status, v_poster_id, v_job_status, v_worker_id, v_bid_amount
    FROM bids b
    JOIN jobs j ON b.job_id = j.id
    WHERE b.id = p_bid_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bid not found');
    END IF;

    -- 2. Validate Permissions (Only Poster can accept)
    IF v_poster_id != v_current_user THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the Job Poster can accept bids');
    END IF;

    -- 3. Validate State
    IF v_job_status != 'OPEN' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job is already in progress or completed');
    END IF;

    -- 4. EXECUTION (Atomic Transaction)
    
    -- A. Update Job -> IN_PROGRESS, Link Accepted Bid, UPDATE BUDGET
    UPDATE jobs 
    SET status = 'IN_PROGRESS', 
        accepted_bid_id = p_bid_id,
        budget = v_bid_amount,  -- Update budget to accepted bid amount
        updated_at = NOW()
    WHERE id = v_job_id;

    -- B. Update Selected Bid -> ACCEPTED
    UPDATE bids 
    SET status = 'ACCEPTED', 
        updated_at = NOW() 
    WHERE id = p_bid_id;

    -- C. Auto-Reject OTHERS and notify them
    FOR v_rejected_bid IN 
        SELECT id, worker_id, worker_name 
        FROM bids 
        WHERE job_id = v_job_id AND id != p_bid_id AND status = 'PENDING'
    LOOP
        -- Update bid status
        UPDATE bids 
        SET status = 'REJECTED', updated_at = NOW()
        WHERE id = v_rejected_bid.id;

        -- Send notification to rejected worker
        INSERT INTO notifications (user_id, title, message, type, related_job_id)
        VALUES (
            v_rejected_bid.worker_id,
            'Bid Not Selected',
            'Your bid was not selected for this job. Keep applying!',
            'INFO',
            v_job_id
        );
    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Ensure permissions are set
GRANT EXECUTE ON FUNCTION action_accept_bid(UUID) TO authenticated;
