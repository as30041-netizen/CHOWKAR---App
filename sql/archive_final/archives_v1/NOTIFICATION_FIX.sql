-- ============================================
-- NOTIFICATION COMPLETENESS FIX
-- ============================================
-- This script updates the cancellation functions to create notifications
-- for all affected parties

-- Updated Cancel Job with Notifications
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
    v_pending_bid RECORD;
    v_posting_fee INTEGER;
    v_connection_fee INTEGER;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    
    SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
    
    IF v_job IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
    IF v_job.poster_id != v_user_id THEN RAISE EXCEPTION 'Only the job poster can cancel'; END IF;
    
    SELECT COALESCE(value::INTEGER, 10) INTO v_posting_fee FROM app_config WHERE key = 'job_posting_fee';
    SELECT COALESCE(value::INTEGER, 20) INTO v_connection_fee FROM app_config WHERE key = 'connection_fee';
    
    IF v_job.status = 'OPEN' THEN
        IF NOT EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id) THEN
            -- No bids - full refund
            UPDATE profiles SET wallet_balance = wallet_balance + v_posting_fee WHERE id = v_user_id;
            INSERT INTO transactions (user_id, amount, type, description, related_job_id)
            VALUES (v_user_id, v_posting_fee, 'CREDIT', 'Job cancelled - Refund', p_job_id);
            UPDATE jobs SET status = 'CANCELLED' WHERE id = p_job_id;
            
            -- Notify poster
            INSERT INTO notifications (user_id, title, message, type, read, related_job_id)
            VALUES (v_user_id, 'Job Cancelled', 'Your job "' || v_job.title || '" has been cancelled. ₹' || v_posting_fee || ' refunded.', 'INFO', false, p_job_id);
            
            v_result := jsonb_build_object('success', true, 'refund_amount', v_posting_fee, 'penalty', false);
        ELSE
            -- Has bids - notify all bidders
            UPDATE jobs SET status = 'CANCELLED' WHERE id = p_job_id;
            
            -- Notify each worker who bid
            FOR v_pending_bid IN SELECT * FROM bids WHERE job_id = p_job_id AND status = 'PENDING'
            LOOP
                INSERT INTO notifications (user_id, title, message, type, read, related_job_id)
                VALUES (v_pending_bid.worker_id, 'Job Cancelled', 'The job "' || v_job.title || '" you bid on has been cancelled by the poster.', 'WARNING', false, p_job_id);
            END LOOP;
            
            v_result := jsonb_build_object('success', true, 'refund_amount', 0, 'penalty', false);
        END IF;
    
    ELSIF v_job.status = 'IN_PROGRESS' THEN
        SELECT * INTO v_accepted_bid FROM bids WHERE id = v_job.accepted_bid_id;
        
        IF v_accepted_bid IS NOT NULL THEN
            IF v_accepted_bid.connection_payment_status = 'PAID' THEN
                -- Refund worker
                UPDATE profiles SET wallet_balance = wallet_balance + v_connection_fee WHERE id = v_accepted_bid.worker_id;
                INSERT INTO transactions (user_id, amount, type, description, related_job_id)
                VALUES (v_accepted_bid.worker_id, v_connection_fee, 'CREDIT', 'Job cancelled by poster - Refund', p_job_id);
            END IF;
            
            -- Notify worker
            INSERT INTO notifications (user_id, title, message, type, read, related_job_id)
            VALUES (v_accepted_bid.worker_id, 'Job Cancelled', 'The poster cancelled "' || v_job.title || '". Your ₹' || v_connection_fee || ' has been refunded.', 'WARNING', false, p_job_id);
        END IF;
        
        UPDATE profiles SET in_progress_cancellations = COALESCE(in_progress_cancellations, 0) + 1 WHERE id = v_user_id;
        UPDATE jobs SET status = 'CANCELLED' WHERE id = p_job_id;
        
        v_result := jsonb_build_object('success', true, 'worker_refund', v_connection_fee, 'penalty', true);
    ELSE
        RAISE EXCEPTION 'Cannot cancel a % job', v_job.status;
    END IF;
    
    RETURN v_result;
END;
$$;

-- Updated Worker Withdrawal with Notifications
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
    
    SELECT * INTO v_bid FROM bids WHERE id = p_bid_id AND worker_id = v_user_id;
    IF v_bid IS NULL THEN RAISE EXCEPTION 'Bid not found or not owned by user'; END IF;
    
    SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
    
    IF v_job.status = 'OPEN' THEN
        UPDATE bids SET status = 'WITHDRAWN' WHERE id = p_bid_id;
        
        -- Notify poster
        INSERT INTO notifications (user_id, title, message, type, read, related_job_id)
        VALUES (v_job.poster_id, 'Bid Withdrawn', v_bid.worker_name || ' has withdrawn their bid from "' || v_job.title || '".', 'INFO', false, p_job_id);
        
        RETURN jsonb_build_object('success', true, 'message', 'Bid withdrawn');
        
    ELSIF v_job.status = 'IN_PROGRESS' AND v_job.accepted_bid_id = p_bid_id THEN
        UPDATE bids SET status = 'WITHDRAWN' WHERE id = p_bid_id;
        UPDATE jobs SET status = 'OPEN', accepted_bid_id = NULL WHERE id = p_job_id;
        
        -- Notify poster urgently
        INSERT INTO notifications (user_id, title, message, type, read, related_job_id)
        VALUES (v_job.poster_id, 'Worker Withdrew', v_bid.worker_name || ' has withdrawn from "' || v_job.title || '". Your job is now open for new bids.', 'ERROR', false, p_job_id);
        
        RETURN jsonb_build_object('success', true, 'message', 'Withdrawn from job. No refund issued.');
    ELSE
        RAISE EXCEPTION 'Cannot withdraw from this job';
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cancel_job_with_refund TO authenticated;
GRANT EXECUTE ON FUNCTION withdraw_from_job TO authenticated;
