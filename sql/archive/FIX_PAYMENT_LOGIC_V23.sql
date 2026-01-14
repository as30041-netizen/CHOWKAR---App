-- ============================================
-- FIX PAYMENT LOGIC V23 (DECOUPLED)
-- 1. Redefine accept_bid and action_accept_bid
-- 2. COMPLETELY REMOVE all wallet/balance checks
-- 3. Ensure hire flow is 100% free and atomic
-- ============================================

-- A. CLEANUP OLD FUNCTIONS
DROP FUNCTION IF EXISTS accept_bid(UUID, UUID, UUID, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS action_accept_bid(UUID);

-- 1. ACTION_ACCEPT_BID (Unified logic for all accept actions)
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
    v_current_user UUID := auth.uid();
BEGIN
    -- 1. Fetch Context
    SELECT b.job_id, b.status, j.poster_id, j.status, b.worker_id
    INTO v_job_id, v_bid_status, v_poster_id, v_job_status, v_worker_id
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
    
    -- A. Update Job -> IN_PROGRESS, Link Accepted Bid
    UPDATE jobs 
    SET status = 'IN_PROGRESS', 
        accepted_bid_id = p_bid_id,
        updated_at = NOW()
    WHERE id = v_job_id;

    -- B. Update Selected Bid -> ACCEPTED
    UPDATE bids 
    SET status = 'ACCEPTED', 
        updated_at = NOW() 
    WHERE id = p_bid_id;

    -- C. Auto-Reject OTHERS
    UPDATE bids 
    SET status = 'REJECTED',
        updated_at = NOW()
    WHERE job_id = v_job_id AND id != p_bid_id AND status = 'PENDING';

    -- D. (Optional) Insert notification system already handles this via trigger
    -- But we return success
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. COMPATIBILITY ALIAS: accept_bid
-- Maps the old complex signature to the new simple one
CREATE OR REPLACE FUNCTION accept_bid(
  p_job_id UUID,
  p_bid_id UUID,
  p_poster_id UUID,
  p_worker_id UUID,
  p_amount INTEGER,
  p_poster_fee INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ignore all financial params, just use the bid_id
    RETURN action_accept_bid(p_bid_id);
END;
$$;

-- 3. PERMISSIONS
GRANT EXECUTE ON FUNCTION action_accept_bid(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_bid(UUID, UUID, UUID, UUID, INTEGER, INTEGER) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✅ V23 Payment-Free Hire Logic Deployed.';
END $$;
