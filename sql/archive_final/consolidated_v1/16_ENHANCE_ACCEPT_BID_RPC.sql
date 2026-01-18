-- ============================================================================
-- ENHANCE ACCEPT BID RPC
-- 1. Notify Winner ("You got the job!")
-- 2. Notify Losers ("Position filled")
-- 3. Initialize Chat (Open line between Poster and Winner)
-- ============================================================================

CREATE OR REPLACE FUNCTION action_accept_bid(
    p_bid_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_id UUID;
    v_poster_id UUID;
    v_worker_id UUID;
    v_job_title TEXT;
    v_job_status TEXT;
    v_bid_amount INTEGER;
BEGIN
    SELECT job_id, worker_id, amount, status INTO v_job_id, v_worker_id, v_bid_amount, v_job_status 
    FROM bids WHERE id = p_bid_id;
    
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Bid not found'); END IF;

    SELECT poster_id, title INTO v_poster_id, v_job_title 
    FROM jobs WHERE id = v_job_id FOR UPDATE;
    
    IF v_poster_id != auth.uid() THEN RETURN json_build_object('success', false, 'error', 'Unauthorized'); END IF;
    
    -- Update Bid (Accept)
    UPDATE bids SET status = 'ACCEPTED', accepted_at = NOW() WHERE id = p_bid_id;
    
    -- Update Job
    UPDATE jobs SET status = 'IN_PROGRESS', accepted_bid_id = p_bid_id WHERE id = v_job_id;
    
    -- Notify Winner
    INSERT INTO notifications (user_id, title, message, type, related_job_id)
    VALUES (
        v_worker_id,
        'You Got the Job! 🎉',
        'Your bid of ₹' || v_bid_amount || ' for "' || v_job_title || '" was accepted. Start chatting now!',
        'SUCCESS',
        v_job_id
    );

    -- Reject others & Notify
    -- We use a CTE to capture the rejected worker IDs for notification
    WITH rejected_bids AS (
        UPDATE bids 
        SET status = 'REJECTED' 
        WHERE job_id = v_job_id AND id != p_bid_id AND status = 'PENDING'
        RETURNING worker_id
    )
    INSERT INTO notifications (user_id, title, message, type, related_job_id)
    SELECT 
        worker_id,
        'Position Filled ⚠️',
        'Another bid was accepted for "' || v_job_title || '". Better luck next time!',
        'INFO',
        v_job_id
    FROM rejected_bids;

    -- Initialize Chat (Ensure visible for both)
    INSERT INTO chat_states (user_id, job_id, is_archived, is_deleted)
    VALUES 
        (v_poster_id, v_job_id, false, false),
        (v_worker_id, v_job_id, false, false)
    ON CONFLICT (user_id, job_id) DO UPDATE SET is_archived = false, is_deleted = false;
    
    RETURN json_build_object('success', true);
END;
$$;
