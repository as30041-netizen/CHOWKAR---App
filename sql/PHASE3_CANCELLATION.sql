-- ============================================
-- PHASE 3: CANCELLATION & PENALTIES
-- ============================================

-- Cancel Job with Refund and Penalty Logic
CREATE OR REPLACE FUNCTION cancel_job_with_refund(
    p_job_id UUID,
    p_reason TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_job RECORD;
    v_accepted_bid RECORD;
    v_posting_fee INTEGER;
    v_connection_fee INTEGER;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    
    -- Get job details
    SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
    
    IF v_job IS NULL THEN
        RAISE EXCEPTION 'Job not found';
    END IF;
    
    -- Only poster can cancel
    IF v_job.poster_id != v_user_id THEN
        RAISE EXCEPTION 'Only the job poster can cancel this job';
    END IF;
    
    -- Get fee config
    SELECT COALESCE(value::INTEGER, 10) INTO v_posting_fee FROM app_config WHERE key = 'job_posting_fee';
    SELECT COALESCE(value::INTEGER, 20) INTO v_connection_fee FROM app_config WHERE key = 'connection_fee';
    
    -- SCENARIO 1: OPEN job with no bids - full refund to wallet
    IF v_job.status = 'OPEN' THEN
        -- Check if no bids
        IF NOT EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id) THEN
            -- Refund posting fee to wallet
            UPDATE profiles 
            SET wallet_balance = wallet_balance + v_posting_fee 
            WHERE id = v_user_id;
            
            -- Record refund transaction
            INSERT INTO transactions (user_id, amount, type, description, related_job_id)
            VALUES (v_user_id, v_posting_fee, 'CREDIT', 'Job cancelled - Refund', p_job_id);
            
            -- Cancel the job
            UPDATE jobs SET status = 'CANCELLED' WHERE id = p_job_id;
            
            v_result := jsonb_build_object(
                'success', true,
                'refund_amount', v_posting_fee,
                'penalty', false
            );
        ELSE
            -- Has bids - no refund
            UPDATE jobs SET status = 'CANCELLED' WHERE id = p_job_id;
            
            v_result := jsonb_build_object(
                'success', true,
                'refund_amount', 0,
                'penalty', false,
                'message', 'Job cancelled but no refund (bids exist)'
            );
        END IF;
    
    -- SCENARIO 2: IN_PROGRESS job - refund worker + track penalty
    ELSIF v_job.status = 'IN_PROGRESS' THEN
        -- Get accepted bid
        SELECT * INTO v_accepted_bid FROM bids 
        WHERE id = v_job.accepted_bid_id;
        
        IF v_accepted_bid IS NOT NULL THEN
            -- Check if worker paid connection fee
            IF v_accepted_bid.connection_payment_status = 'PAID' THEN
                -- Refund worker's connection fee
                UPDATE profiles 
                SET wallet_balance = wallet_balance + v_connection_fee 
                WHERE id = v_accepted_bid.worker_id;
                
                -- Record refund transaction for worker
                INSERT INTO transactions (user_id, amount, type, description, related_job_id)
                VALUES (v_accepted_bid.worker_id, v_connection_fee, 'CREDIT', 'Job cancelled by poster - Connection fee refund', p_job_id);
            END IF;
        END IF;
        
        -- Increment poster's cancellation count (penalty tracking)
        UPDATE profiles 
        SET in_progress_cancellations = COALESCE(in_progress_cancellations, 0) + 1
        WHERE id = v_user_id;
        
        -- Cancel the job
        UPDATE jobs SET status = 'CANCELLED' WHERE id = p_job_id;
        
        v_result := jsonb_build_object(
            'success', true,
            'refund_amount', 0,
            'worker_refund', v_connection_fee,
            'penalty', true,
            'message', 'Job cancelled. Worker refunded. Penalty recorded.'
        );
    
    ELSE
        -- Job is already COMPLETED or CANCELLED
        RAISE EXCEPTION 'Cannot cancel a job that is % ', v_job.status;
    END IF;
    
    RETURN v_result;
END;
$$;

-- Worker Withdrawal Function (no refund)
CREATE OR REPLACE FUNCTION withdraw_from_job(
    p_job_id UUID,
    p_bid_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_bid RECORD;
    v_job RECORD;
BEGIN
    v_user_id := auth.uid();
    
    -- Get bid details
    SELECT * INTO v_bid FROM bids WHERE id = p_bid_id AND worker_id = v_user_id;
    
    IF v_bid IS NULL THEN
        RAISE EXCEPTION 'Bid not found or not owned by user';
    END IF;
    
    -- Get job details
    SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
    
    IF v_job.status = 'OPEN' THEN
        -- Before acceptance - simple withdraw, no penalty
        UPDATE bids SET status = 'WITHDRAWN' WHERE id = p_bid_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Bid withdrawn successfully'
        );
        
    ELSIF v_job.status = 'IN_PROGRESS' AND v_job.accepted_bid_id = p_bid_id THEN
        -- After acceptance - NO REFUND of connection fee
        -- Just mark bid as withdrawn and reopen job
        UPDATE bids SET status = 'WITHDRAWN' WHERE id = p_bid_id;
        UPDATE jobs SET status = 'OPEN', accepted_bid_id = NULL WHERE id = p_job_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Withdrawn from job. No refund issued.',
            'refund', 0
        );
    ELSE
        RAISE EXCEPTION 'Cannot withdraw from this job';
    END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cancel_job_with_refund TO authenticated;
GRANT EXECUTE ON FUNCTION withdraw_from_job TO authenticated;
