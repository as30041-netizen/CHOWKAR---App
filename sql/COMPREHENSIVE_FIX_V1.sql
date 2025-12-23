-- ========================================================
-- COMPREHENSIVE FIX V1.1: RPCs, NOTIFICATIONS, & RELIABILITY
-- ========================================================
-- This script addresses multiple critical issues:
-- 1. mark_messages_read 400 Error (adds updated_at to notifications)
-- 2. Bid Acceptance Logic & Notifications (Fixes trigger status check)
-- 3. Worker Bid Visibility (Enables RLS)
-- 4. Real-time Notifications (Ensures triggers exist)

BEGIN;

-- ========================================================
-- 1. SCHEMA FIXES
-- ========================================================

-- Add updated_at to notifications to fix RPC error
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Fix potential missing columns in chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- ========================================================
-- 2. MARK MESSAGES READ (Combined Fix)
-- ========================================================

-- DROP to avoid "cannot change return type" error
DROP FUNCTION IF EXISTS mark_messages_read(uuid, uuid);

CREATE OR REPLACE FUNCTION mark_messages_read(p_job_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A. Mark Chat Messages as Read (Updates Read Receipts)
  UPDATE chat_messages 
  SET read = TRUE, read_at = NOW()
  WHERE job_id = p_job_id 
    AND receiver_id = p_user_id 
    AND read = FALSE;

  -- B. Mark Related Notifications as Read (Clears Bell Icon)
  UPDATE notifications
  SET read = TRUE, updated_at = NOW()
  WHERE user_id = p_user_id
    AND related_job_id = p_job_id
    AND read = FALSE;
END;
$$;

-- ========================================================
-- 3. ACCEPT BID RPC (Robust Definition)
-- ========================================================

-- DROP to avoid "cannot change return type" error
DROP FUNCTION IF EXISTS accept_bid(uuid, uuid, uuid, uuid, integer, integer);

CREATE OR REPLACE FUNCTION accept_bid(
  p_job_id uuid,
  p_bid_id uuid,
  p_poster_id uuid,
  p_worker_id uuid,
  p_amount integer,
  p_poster_fee integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_job_status text;
  v_bid_exists boolean;
  v_worker_commission integer;
BEGIN
  -- Validate Job
  SELECT status INTO v_job_status FROM jobs WHERE id = p_job_id;
  IF v_job_status != 'OPEN' THEN
    RAISE EXCEPTION 'Job is no longer OPEN (Status: %)', v_job_status;
  END IF;

  -- Validate Bid
  SELECT EXISTS(SELECT 1 FROM bids WHERE id = p_bid_id AND status = 'PENDING') INTO v_bid_exists;
  IF NOT v_bid_exists THEN
    RAISE EXCEPTION 'Bid not found or not PENDING';
  END IF;

  -- Calculate Worker Commission (5%)
  v_worker_commission := CEIL(p_amount * 0.05);

  -- Execute Financial Updates (Deduct minimal/zero fees if configured so)
  UPDATE profiles SET wallet_balance = wallet_balance - p_poster_fee WHERE id = p_poster_id;
  UPDATE profiles SET wallet_balance = wallet_balance - v_worker_commission WHERE id = p_worker_id;

  -- Update Job Status
  UPDATE jobs 
  SET status = 'IN_PROGRESS', 
      accepted_bid_id = p_bid_id 
  WHERE id = p_job_id;

  -- Update Bids Status (Accept One, Reject Others)
  UPDATE bids SET status = 'ACCEPTED' WHERE id = p_bid_id;
  UPDATE bids SET status = 'REJECTED' WHERE job_id = p_job_id AND id != p_bid_id;

  -- Insert Transaction Records
  INSERT INTO transactions (user_id, amount, type, description, related_job_id)
  VALUES (p_poster_id, p_poster_fee, 'DEBIT', 'Booking Fee', p_job_id);

  INSERT INTO transactions (user_id, amount, type, description, related_job_id)
  VALUES (p_worker_id, v_worker_commission, 'DEBIT', 'Success Fee (5%)', p_job_id);
END;
$$;

-- ========================================================
-- 4. NOTIFICATION TRIGGERS (Fixed Status Checks)
-- ========================================================

-- A. Notify Winner & Others on Bid Acceptance
-- FIXED: Checks for status = 'ACCEPTED', not 'IN_PROGRESS'
CREATE OR REPLACE FUNCTION notify_on_bid_accept()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_poster_name TEXT;
BEGIN
  -- Check if Bid status changed to ACCEPTED
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' THEN
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
    
    -- Notify WINNER
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at, updated_at)
    VALUES (
      NEW.worker_id,
      'SUCCESS',
      'You''re Hired! 🎉',
      COALESCE(v_poster_name, 'Employer') || ' is waiting to discuss "' || v_job.title || '" with you. Chat now!',
      NEW.job_id,
      false,
      NOW(),
      NOW()
    );
     
  -- Check if Bid status changed to REJECTED (Batch rejection when another is accepted)
  ELSIF NEW.status = 'REJECTED' AND OLD.status = 'PENDING' THEN
     -- Only notify if this rejection happened at the same time another bid was accepted (checked via job status)
     -- Or just notify generally "Bid Not Selected"
     SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
     
     INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at, updated_at)
     VALUES (
       NEW.worker_id,
       'INFO',
       'Position Filled',
       'Another worker was selected for "' || v_job.title || '". Keep browsing!',
       NEW.job_id,
       false,
       NOW(),
       NOW()
     );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_bid_accept ON bids;
CREATE TRIGGER trigger_notify_on_bid_accept 
AFTER UPDATE ON bids 
FOR EACH ROW 
EXECUTE FUNCTION notify_on_bid_accept();


-- B. Notify Poster on New Bid
CREATE OR REPLACE FUNCTION notify_poster_on_new_bid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_worker_name TEXT;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;

  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at, updated_at)
  VALUES (
    v_job.poster_id, 
    'INFO', 
    'New Bid: ₹' || NEW.amount || ' 🔔', 
    COALESCE(v_worker_name, 'A worker') || ' has placed a bid on "' || v_job.title || '"', 
    NEW.job_id, 
    false, 
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
CREATE TRIGGER on_bid_created_notify 
AFTER INSERT ON bids 
FOR EACH ROW 
EXECUTE FUNCTION notify_poster_on_new_bid();

-- ========================================================
-- 5. ROW LEVEL SECURITY (Worker Privacy)
-- ========================================================
-- Prevent workers from seeing each other's bids

ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bids" ON bids;
CREATE POLICY "Users can view their own bids" ON bids 
FOR SELECT USING (auth.uid() = worker_id);

DROP POLICY IF EXISTS "Posters can view all bids on their jobs" ON bids;
CREATE POLICY "Posters can view all bids on their jobs" ON bids 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = bids.job_id 
    AND jobs.poster_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert their own bids" ON bids;
CREATE POLICY "Users can insert their own bids" ON bids 
FOR INSERT WITH CHECK (auth.uid() = worker_id);

DROP POLICY IF EXISTS "Users can update their own bids" ON bids;
CREATE POLICY "Users can update their own bids" ON bids 
FOR UPDATE USING (auth.uid() = worker_id);

-- Note: RPCs like 'accept_bid' bypass RLS due to SECURITY DEFINER

COMMIT;
