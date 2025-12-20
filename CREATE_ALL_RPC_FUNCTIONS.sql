-- ============================================
-- COMPLETE BIDDING SYSTEM - ALL MISSING RPC FUNCTIONS
-- ============================================
-- This script creates ALL missing database functions
-- that the app is calling but don't exist yet
-- ============================================

-- ============================================
-- DROP ALL EXISTING FUNCTION VERSIONS (handles overloads)
-- ============================================

DO $$
DECLARE
  func_names TEXT[] := ARRAY[
    'accept_bid',
    'process_transaction',
    'get_job_contact',
    'mark_messages_read',
    'mark_all_notifications_read',
    'clear_all_notifications',
    'soft_delete_notification',
    'soft_delete_chat_message',
    'archive_chat',
    'unarchive_chat',
    'delete_chat',
    'check_expired_bid_deadlines',
    'cancel_job_with_refund',
    'withdraw_from_job',
    'charge_commission'
  ];
  func_name TEXT;
  func_oid OID;
BEGIN
  -- Loop through each function name
  FOREACH func_name IN ARRAY func_names LOOP
    -- Drop ALL overloaded versions of this function
    FOR func_oid IN 
      SELECT oid FROM pg_proc 
      WHERE proname = func_name 
      AND pronamespace = 'public'::regnamespace
    LOOP
      EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', func_oid::regprocedure);
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '🗑️  Dropped ALL existing function versions';
  RAISE NOTICE '';
  RAISE NOTICE 'Creating new functions...';
  RAISE NOTICE '';
END $$;

-- ============================================
-- 1. ACCEPT_BID - MOST CRITICAL!
-- Parameters match frontend: p_job_id, p_bid_id, p_poster_id, p_worker_id, p_amount, p_poster_fee
-- ============================================

CREATE OR REPLACE FUNCTION accept_bid(
  p_job_id UUID,
  p_bid_id UUID,
  p_poster_id UUID,
  p_worker_id UUID,
  p_amount INTEGER,
  p_poster_fee INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_job RECORD;
  v_poster_name TEXT;
  v_worker_name TEXT;
BEGIN
  -- 1. Verify poster owns this job
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id AND poster_id = p_poster_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or you are not the poster';
  END IF;
  
  -- 2. Verify job is still OPEN
  IF v_job.status != 'OPEN' THEN
    RAISE EXCEPTION 'Job is no longer open';
  END IF;
  
  -- 3. Update the accepted bid status
  UPDATE bids 
  SET status = 'ACCEPTED', updated_at = NOW()
  WHERE id = p_bid_id AND job_id = p_job_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bid not found';
  END IF;
  
  -- 4. Reject all other bids on this job
  UPDATE bids
  SET status = 'REJECTED', updated_at = NOW()
  WHERE job_id = p_job_id AND id != p_bid_id AND status = 'PENDING';
  
  -- 5. Update job status to IN_PROGRESS and set accepted_bid_id
  UPDATE jobs
  SET 
    status = 'IN_PROGRESS',
    accepted_bid_id = p_bid_id,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- 6. Get names for notifications (triggers will handle notification creation)
  SELECT name INTO v_poster_name FROM profiles WHERE id = p_poster_id;
  SELECT name INTO v_worker_name FROM profiles WHERE id = p_worker_id;
  
  -- 7. Return success
  v_result := json_build_object(
    'success', true,
    'message', 'Bid accepted successfully',
    'bid_id', p_bid_id,
    'job_id', p_job_id,
    'worker_id', p_worker_id,
    'amount', p_amount
  );
  
  RAISE NOTICE '✅ Bid accepted: % for job: % amount: %', p_bid_id, p_job_id, p_amount;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error accepting bid: %', SQLERRM;
END;
$$;

-- ============================================
-- 2. PROCESS_TRANSACTION (Wallet operations)
-- Uses auth.uid() to get current user - matches frontend call
-- Frontend calls: supabase.rpc('process_transaction', { p_amount, p_type, p_description })
-- ============================================

CREATE OR REPLACE FUNCTION process_transaction(
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Get current user from auth session
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get current balance with row lock
  SELECT wallet_balance INTO v_current_balance
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE; -- Lock the row
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  -- Calculate new balance
  IF p_type = 'CREDIT' THEN
    v_new_balance := v_current_balance + p_amount;
  ELSIF p_type = 'DEBIT' THEN
    v_new_balance := v_current_balance - p_amount;
    
    -- Check sufficient balance
    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid transaction type. Use CREDIT or DEBIT.';
  END IF;
  
  -- Update wallet balance
  UPDATE profiles
  SET wallet_balance = v_new_balance, updated_at = NOW()
  WHERE id = v_user_id;
  
  -- Create transaction record
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (v_user_id, p_amount, p_type, p_description)
  RETURNING id INTO v_transaction_id;
  
  RAISE NOTICE '✅ Transaction processed: % ₹% for user %', p_type, p_amount, v_user_id;
  
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Transaction failed: %', SQLERRM;
END;
$$;

-- ============================================
-- 3. GET_JOB_CONTACT (Security function)
-- ============================================

CREATE OR REPLACE FUNCTION get_job_contact(p_job_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_user_id UUID;
  v_is_poster BOOLEAN;
  v_is_accepted_worker BOOLEAN;
  v_result JSON;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get job details
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  
  -- Check if user is poster
  v_is_poster := (v_job.poster_id = v_user_id);
  
  -- Check if user is accepted worker
  IF v_job.accepted_bid_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM bids 
      WHERE id = v_job.accepted_bid_id 
      AND worker_id = v_user_id
    ) INTO v_is_accepted_worker;
  ELSE
    v_is_accepted_worker := FALSE;
  END IF;
  
  -- Only poster and accepted worker can see contact details
  IF NOT (v_is_poster OR v_is_accepted_worker) THEN
    RAISE EXCEPTION 'Not authorized to view contact details';
  END IF;
  
  -- Return contact info
  IF v_is_poster THEN
    -- Poster gets worker contact
    SELECT json_build_object(
      'name', worker_name,
      'phone', worker_phone,
      'location', worker_location
    ) INTO v_result
    FROM bids
    WHERE id = v_job.accepted_bid_id;
  ELSE
    -- Worker gets poster contact
    v_result := json_build_object(
      'name', v_job.poster_name,
      'phone', v_job.poster_phone,
      'location', v_job.location
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- ============================================
-- 4. MARK_MESSAGES_READ
-- ============================================

CREATE OR REPLACE FUNCTION mark_messages_read(
  p_job_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark notifications for messages in this job as read
  UPDATE notifications
  SET read = TRUE, updated_at = NOW()
  WHERE user_id = p_user_id
    AND related_job_id = p_job_id
    AND type = 'INFO'
    AND title LIKE '%Message%'
    AND read = FALSE;
  
  RAISE NOTICE '✅ Messages marked as read for job % user %', p_job_id, p_user_id;
END;
$$;

-- ============================================
-- 5. MARK_ALL_NOTIFICATIONS_READ
-- ============================================

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
  SET read = TRUE
  WHERE user_id = auth.uid() AND read = FALSE;
  
  RAISE NOTICE '✅ All notifications marked as read for user %', auth.uid();
END;
$$;

-- ============================================
-- 6. CLEAR_ALL_NOTIFICATIONS
-- ============================================

CREATE OR REPLACE FUNCTION clear_all_notifications()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications
  WHERE user_id = auth.uid();
  
  RAISE NOTICE '✅ All notifications cleared for user %', auth.uid();
END;
$$;

-- ============================================
-- 7. SOFT_DELETE_NOTIFICATION
-- ============================================

CREATE OR REPLACE FUNCTION soft_delete_notification(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications
  WHERE id = p_notification_id AND user_id = auth.uid();
  
  RAISE NOTICE '✅ Notification deleted: %', p_notification_id;
END;
$$;

-- ============================================
-- 8. SOFT_DELETE_CHAT_MESSAGE
-- ============================================

CREATE OR REPLACE FUNCTION soft_delete_chat_message(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only sender can delete their own message
  DELETE FROM chat_messages
  WHERE id = p_message_id AND sender_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or you are not the sender';
  END IF;
  
  RAISE NOTICE '✅ Message deleted: %', p_message_id;
END;
$$;

-- ============================================
-- 9. ARCHIVE/UNARCHIVE/DELETE CHAT (Placeholders)
-- These may need a separate chats table or metadata
-- For now, we'll create stubs
-- ============================================

CREATE OR REPLACE FUNCTION archive_chat(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- TODO: Implement chat archiving if needed
  RAISE NOTICE 'Chat archiving not yet implemented';
END;
$$;

CREATE OR REPLACE FUNCTION unarchive_chat(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- TODO: Implement chat un archiving if needed
  RAISE NOTICE 'Chat unarchiving not yet implemented';
END;
$$;

CREATE OR REPLACE FUNCTION delete_chat(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete all messages for this job where user is participant
  DELETE FROM chat_messages
  WHERE job_id = p_job_id
  AND (
    sender_id = auth.uid() OR
    job_id IN (
      SELECT id FROM jobs WHERE poster_id = auth.uid()
    ) OR
    job_id IN (
      SELECT job_id FROM bids WHERE worker_id = auth.uid()
    )
  );
  
  RAISE NOTICE '✅ Chat deleted for job: %', p_job_id;
END;
$$;

-- ============================================
-- 10. CHECK_EXPIRED_BID_DEADLINES
-- ============================================

CREATE OR REPLACE FUNCTION check_expired_bid_deadlines()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER := 0;
BEGIN
  -- Find bids that were accepted >24hrs ago but job still IN_PROGRESS
  -- This would be for payment deadline enforcement
  -- For now, we'll just return 0 as a placeholder
  
  -- TODO: Implement actual deadline checking logic if needed
  
  RETURN v_expired_count;
END;
$$;

-- ============================================
-- 11. CANCEL_JOB_WITH_REFUND
-- ============================================

CREATE OR REPLACE FUNCTION cancel_job_with_refund(
  p_job_id UUID,
  p_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_refund_amount INTEGER := 0;
  v_result JSON;
BEGIN
  -- Get job
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id AND poster_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or you are not the poster';
  END IF;
  
  -- Can only cancel OPEN jobs or IN_PROGRESS (with penalty)
  IF v_job.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'Cannot cancel completed job';
  END IF;
  
  -- Update job status
  UPDATE jobs
  SET status = 'COMPLETED', -- Or create CANCELLED status
      updated_at = NOW()
  WHERE id = p_job_id;
  
  -- TODO: Calculate refund based on status and implement refund logic
  
  v_result := json_build_object(
    'success', true,
    'refund_amount', v_refund_amount,
    'penalty', false
  );
  
  RETURN v_result;
END;
$$;

-- ============================================
-- 12. WITHDRAW_FROM_JOB
-- ============================================

CREATE OR REPLACE FUNCTION withdraw_from_job(
  p_job_id UUID,
  p_bid_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid RECORD;
  v_result JSON;
BEGIN
  -- Get bid
  SELECT * INTO v_bid FROM bids 
  WHERE id = p_bid_id AND worker_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bid not found or you are not the worker';
  END IF;
  
  -- Can only withdraw PENDING bids
  IF v_bid.status != 'PENDING' THEN
    RAISE EXCEPTION 'Can only withdraw pending bids';
  END IF;
  
  -- Delete the bid
  DELETE FROM bids WHERE id = p_bid_id;
  
  v_result := json_build_object(
    'success', true,
    'message', 'Bid withdrawn successfully'
  );
  
  RETURN v_result;
END;
$$;

-- ============================================
-- 13. CHARGE_COMMISSION
-- ============================================

CREATE OR REPLACE FUNCTION charge_commission(
  p_job_id UUID,
  p_worker_id UUID,
  p_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deduct commission from worker's wallet
  UPDATE profiles
  SET wallet_balance = wallet_balance - p_amount
  WHERE id = p_worker_id;
  
  -- Create transaction record
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (
    p_worker_id,
    p_amount,
    'DEBIT',
    'Commission for job ' || p_job_id
  );
  
  RAISE NOTICE '✅ Commission charged: % from worker %', p_amount, p_worker_id;
END;
$$;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check all functions exist
SELECT 
  routine_name,
  '✅ Exists' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'accept_bid',
  'process_transaction',
  'get_job_contact',
  'mark_messages_read',
  'mark_all_notifications_read',
  'clear_all_notifications',
  'soft_delete_notification',
  'soft_delete_chat_message',
  'archive_chat',
  'unarchive_chat',
  'delete_chat',
  'check_expired_bid_deadlines',
  'cancel_job_with_refund',
  'withdraw_from_job',
  'charge_commission'
)
ORDER BY routine_name;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ ALL MISSING RPC FUNCTIONS CREATED';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions Created:';
  RAISE NOTICE '1. ✅ accept_bid - Accept bid and update job';
  RAISE NOTICE '2. ✅ process_transaction - Wallet operations';
  RAISE NOTICE '3. ✅ get_job_contact - Get contact details';
  RAISE NOTICE '4. ✅ mark_messages_read - Mark messages read';
  RAISE NOTICE '5. ✅ mark_all_notifications_read - Mark all read';
  RAISE NOTICE '6. ✅ clear_all_notifications - Clear all';
  RAISE NOTICE '7. ✅ soft_delete_notification - Delete one';
  RAISE NOTICE '8. ✅ soft_delete_chat_message - Delete message';
  RAISE NOTICE '9. ✅ archive/unarchive/delete_chat - Chat mgmt';
  RAISE NOTICE '10. ✅ check_expired_bid_deadlines - Check deadlines';
  RAISE NOTICE '11. ✅ cancel_job_with_refund - Cancel job';
  RAISE NOTICE '12. ✅ withdraw_from_job - Withdraw bid';
  RAISE NOTICE '13. ✅ charge_commission - Charge commission';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT: Test bid acceptance flow';
  RAISE NOTICE '================================================';
END $$;
