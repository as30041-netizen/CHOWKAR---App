-- ============================================
-- PHASE 5: 24-HOUR PAYMENT DEADLINE
-- ============================================

-- 1. Add timestamp for when bid was accepted
ALTER TABLE bids ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- 2. Drop existing accept_bid function (return type changed)
DROP FUNCTION IF EXISTS accept_bid(uuid, uuid, uuid, uuid, integer, integer);

-- 3. Update accept_bid RPC to set accepted_at
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
    -- Update job status
    UPDATE jobs 
    SET status = 'IN_PROGRESS', accepted_bid_id = p_bid_id 
    WHERE id = p_job_id AND poster_id = p_poster_id;

    -- Update accepted bid status and set accepted_at timestamp
    UPDATE bids 
    SET status = 'ACCEPTED', accepted_at = NOW()
    WHERE id = p_bid_id;

    -- Reject all other bids
    UPDATE bids 
    SET status = 'REJECTED' 
    WHERE job_id = p_job_id AND id != p_bid_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Function to check and expire old bids (call this periodically or on demand)
CREATE OR REPLACE FUNCTION check_expired_bid_deadlines()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expired_count INTEGER := 0;
    v_bid RECORD;
    v_job RECORD;
    v_posting_fee INTEGER;
BEGIN
    -- Get posting fee for refunds
    SELECT COALESCE(value::INTEGER, 10) INTO v_posting_fee FROM app_config WHERE key = 'job_posting_fee';
    
    -- Find bids that:
    -- 1. Have status = 'ACCEPTED' (poster accepted but worker hasn't paid)
    -- 2. connection_payment_status != 'PAID' (worker hasn't paid)
    -- 3. accepted_at is more than 24 hours ago
    FOR v_bid IN 
        SELECT b.*, j.poster_id, j.title as job_title, j.id as job_id
        FROM bids b
        JOIN jobs j ON j.id = b.job_id
        WHERE b.status = 'ACCEPTED'
        AND (b.connection_payment_status IS NULL OR b.connection_payment_status != 'PAID')
        AND b.accepted_at IS NOT NULL
        AND b.accepted_at < NOW() - INTERVAL '24 hours'
    LOOP
        -- Reject the bid
        UPDATE bids SET status = 'EXPIRED' WHERE id = v_bid.id;
        
        -- Reopen the job
        UPDATE jobs SET status = 'OPEN', accepted_bid_id = NULL WHERE id = v_bid.job_id;
        
        -- Refund poster's posting fee
        UPDATE profiles 
        SET wallet_balance = wallet_balance + v_posting_fee 
        WHERE id = v_bid.poster_id;
        
        -- Record refund transaction
        INSERT INTO transactions (user_id, amount, type, description, related_job_id)
        VALUES (v_bid.poster_id, v_posting_fee, 'CREDIT', 'Worker did not pay in time - Refund', v_bid.job_id);
        
        -- Create notification for poster
        INSERT INTO notifications (user_id, title, message, type, read, related_job_id)
        VALUES (
            v_bid.poster_id,
            'Bid Expired',
            'Worker did not pay within 24 hours for "' || v_bid.job_title || '". Your ₹' || v_posting_fee || ' has been refunded. Your job is open for new bids.',
            'WARNING',
            false,
            v_bid.job_id
        );
        
        -- Create notification for worker
        INSERT INTO notifications (user_id, title, message, type, read, related_job_id)
        VALUES (
            v_bid.worker_id,
            'Bid Expired',
            'You did not pay within 24 hours for "' || v_bid.job_title || '". The bid has been cancelled.',
            'ERROR',
            false,
            v_bid.job_id
        );
        
        v_expired_count := v_expired_count + 1;
    END LOOP;
    
    RETURN v_expired_count;
END;
$$;

-- 4. Function to get time remaining for a bid (for UI countdown)
CREATE OR REPLACE FUNCTION get_bid_deadline_remaining(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bid RECORD;
    v_deadline TIMESTAMPTZ;
    v_remaining INTERVAL;
    v_hours INTEGER;
    v_minutes INTEGER;
BEGIN
    SELECT * INTO v_bid FROM bids WHERE id = p_bid_id;
    
    IF v_bid IS NULL OR v_bid.accepted_at IS NULL THEN
        RETURN jsonb_build_object('has_deadline', false);
    END IF;
    
    v_deadline := v_bid.accepted_at + INTERVAL '24 hours';
    v_remaining := v_deadline - NOW();
    
    IF v_remaining < INTERVAL '0 seconds' THEN
        RETURN jsonb_build_object(
            'has_deadline', true,
            'expired', true,
            'remaining_hours', 0,
            'remaining_minutes', 0
        );
    END IF;
    
    v_hours := EXTRACT(EPOCH FROM v_remaining)::INTEGER / 3600;
    v_minutes := (EXTRACT(EPOCH FROM v_remaining)::INTEGER % 3600) / 60;
    
    RETURN jsonb_build_object(
        'has_deadline', true,
        'expired', false,
        'remaining_hours', v_hours,
        'remaining_minutes', v_minutes,
        'deadline', v_deadline
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION accept_bid TO authenticated;
GRANT EXECUTE ON FUNCTION check_expired_bid_deadlines TO authenticated;
GRANT EXECUTE ON FUNCTION get_bid_deadline_remaining TO authenticated;

-- NOTE: For automatic expiration, you need to either:
-- 1. Set up pg_cron to run check_expired_bid_deadlines() every hour
-- 2. OR call check_expired_bid_deadlines() from your frontend periodically
