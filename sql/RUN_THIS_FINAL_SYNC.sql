-- ========================================================
-- UNIFIED FINAL SYNC SCRIPT
-- ========================================================
-- This is the SINGLE script to run after all previous fixes.
-- It consolidates and finalizes all security, chat, and notification features.
-- 
-- Prerequisites:
-- 1. FIX_SCALABILITY_AND_SAFETY_V3.sql (already run)
-- 2. SECURITY_HARDENING.sql (already run)
-- 3. FIX_PHONE_NULL_CONSTRAINT.sql (already run)
--
-- This script SUPPLEMENTS those with missing pieces.

BEGIN;

-- ========================================================
-- 1. CHAT ENHANCEMENTS (Read Receipts, Archive, Media)
-- ========================================================

-- Add columns if they don't exist
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('voice', 'image', 'video'));
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_duration INTEGER;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(p_job_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE chat_messages 
  SET read = TRUE, read_at = NOW()
  WHERE job_id = p_job_id 
    AND receiver_id = p_user_id 
    AND read = FALSE
    AND sender_id != p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- 2. ENHANCED CANCELLATION WITH NOTIFICATIONS
-- ========================================================
-- This version adds rich notifications to the cancellation flow

DROP FUNCTION IF EXISTS cancel_job_with_refund(UUID, TEXT);

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
    
    -- Get Job
    SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
    
    IF v_job IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
    IF v_job.poster_id != v_user_id THEN RAISE EXCEPTION 'Only the job poster can cancel'; END IF;
    
    -- Get Fees Config (Fallback to defaults)
    SELECT COALESCE(value::INTEGER, 10) INTO v_posting_fee FROM app_config WHERE key = 'job_posting_fee';
    SELECT COALESCE(value::INTEGER, 20) INTO v_connection_fee FROM app_config WHERE key = 'connection_fee';
    
    v_posting_fee := COALESCE(v_posting_fee, 10);
    v_connection_fee := COALESCE(v_connection_fee, 20);

    IF v_job.status = 'OPEN' THEN
        IF NOT EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id) THEN
            -- No bids - cancel without notifications
            UPDATE jobs SET status = 'CANCELLED' WHERE id = p_job_id;
            
            INSERT INTO notifications (user_id, title, message, type, read, related_job_id)
            VALUES (v_user_id, 'Job Cancelled', 'Your job "' || v_job.title || '" has been cancelled.', 'INFO', false, p_job_id);
            
            v_result := jsonb_build_object('success', true, 'refund_amount', 0, 'penalty', false);
        ELSE
            -- Has bids - notify all bidders
            UPDATE jobs SET status = 'CANCELLED' WHERE id = p_job_id;
            
            FOR v_pending_bid IN SELECT * FROM bids WHERE job_id = p_job_id AND status = 'PENDING'
            LOOP
                INSERT INTO notifications (user_id, title, message, type, read, related_job_id)
                VALUES (v_pending_bid.worker_id, 'Job Cancelled', 'The job "' || v_job.title || '" you bid on has been cancelled.', 'WARNING', false, p_job_id);
            END LOOP;
            
            v_result := jsonb_build_object('success', true, 'refund_amount', 0, 'penalty', false);
        END IF;
    
    ELSIF v_job.status = 'IN_PROGRESS' THEN
        SELECT * INTO v_accepted_bid FROM bids WHERE id = v_job.accepted_bid_id;
        
        IF v_accepted_bid IS NOT NULL THEN
            -- Refund worker
            UPDATE profiles SET wallet_balance = COALESCE(wallet_balance, 0) + v_connection_fee WHERE id = v_accepted_bid.worker_id;
            
            INSERT INTO transactions (user_id, amount, type, description, related_job_id)
            VALUES (v_accepted_bid.worker_id, v_connection_fee, 'CREDIT', 'Job cancelled by poster - Refund', p_job_id);
            
            -- Notify worker
            INSERT INTO notifications (user_id, title, message, type, read, related_job_id)
            VALUES (v_accepted_bid.worker_id, 'Job Cancelled', 'The poster cancelled "' || v_job.title || '". Your fee has been refunded.', 'WARNING', false, p_job_id);
        END IF;
        
        UPDATE jobs SET status = 'CANCELLED' WHERE id = p_job_id;
        
        v_result := jsonb_build_object('success', true, 'worker_refund', v_connection_fee, 'penalty', true);
    ELSE
        RAISE EXCEPTION 'Cannot cancel a % job', v_job.status;
    END IF;
    
    RETURN v_result;
END;
$$;

-- ========================================================
-- 3. CHAT ARCHIVE FUNCTIONS
-- ========================================================

CREATE OR REPLACE FUNCTION archive_chat(p_job_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_other_user_id UUID;
BEGIN
  -- Determine the other user in the conversation
  SELECT CASE 
    WHEN j.poster_id = v_user_id THEN COALESCE(b.worker_id, j.poster_id)
    ELSE j.poster_id 
  END INTO v_other_user_id
  FROM jobs j
  LEFT JOIN bids b ON b.job_id = j.id AND b.status = 'ACCEPTED'
  WHERE j.id = p_job_id
  LIMIT 1;

  -- Insert or update chat record
  INSERT INTO chats (
    job_id, 
    user1_id, 
    user2_id, 
    user1_archived,
    user2_archived,
    created_at,
    updated_at
  )
  VALUES (
    p_job_id,
    LEAST(v_user_id, v_other_user_id),
    GREATEST(v_user_id, v_other_user_id),
    CASE WHEN LEAST(v_user_id, v_other_user_id) = v_user_id THEN TRUE ELSE FALSE END,
    CASE WHEN GREATEST(v_user_id, v_other_user_id) = v_user_id THEN TRUE ELSE FALSE END,
    NOW(),
    NOW()
  )
  ON CONFLICT (job_id, user1_id, user2_id) 
  DO UPDATE SET 
    user1_archived = CASE WHEN chats.user1_id = v_user_id THEN TRUE ELSE chats.user1_archived END,
    user2_archived = CASE WHEN chats.user2_id = v_user_id THEN TRUE ELSE chats.user2_archived END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unarchive function
CREATE OR REPLACE FUNCTION unarchive_chat(p_job_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  UPDATE chats
  SET 
    user1_archived = CASE WHEN user1_id = v_user_id THEN FALSE ELSE user1_archived END,
    user2_archived = CASE WHEN user2_id = v_user_id THEN FALSE ELSE user2_archived END,
    updated_at = NOW()
  WHERE job_id = p_job_id
    AND (user1_id = v_user_id OR user2_id = v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete chat function
CREATE OR REPLACE FUNCTION delete_chat(p_job_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_other_user_id UUID;
BEGIN
  -- Determine the other user
  SELECT CASE 
    WHEN j.poster_id = v_user_id THEN COALESCE(b.worker_id, j.poster_id)
    ELSE j.poster_id 
  END INTO v_other_user_id
  FROM jobs j
  LEFT JOIN bids b ON b.job_id = j.id AND b.status = 'ACCEPTED'
  WHERE j.id = p_job_id
  LIMIT 1;

  -- Insert or update chat record with deleted_until timestamp
  INSERT INTO chats (
    job_id, 
    user1_id, 
    user2_id,
    user1_deleted_until,
    user2_deleted_until,
    created_at,
    updated_at
  )
  VALUES (
    p_job_id,
    LEAST(v_user_id, v_other_user_id),
    GREATEST(v_user_id, v_other_user_id),
    CASE WHEN LEAST(v_user_id, v_other_user_id) = v_user_id THEN NOW() ELSE NULL END,
    CASE WHEN GREATEST(v_user_id, v_other_user_id) = v_user_id THEN NOW() ELSE NULL END,
    NOW(),
    NOW()
  )
  ON CONFLICT (job_id, user1_id, user2_id) 
  DO UPDATE SET 
    user1_deleted_until = CASE WHEN chats.user1_id = v_user_id THEN NOW() ELSE chats.user1_deleted_until END,
    user2_deleted_until = CASE WHEN chats.user2_id = v_user_id THEN NOW() ELSE chats.user2_deleted_until END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- ========================================================
-- VERIFICATION
-- ========================================================
-- After running this script, verify:
-- 1. SELECT * FROM chat_messages LIMIT 1; -- Should show 'read' column
-- 2. SELECT * FROM chats LIMIT 1; -- Should exist and have archive columns
-- 3. Test cancelling a job and check notifications appear
-- 4. Test archiving a chat in the UI
