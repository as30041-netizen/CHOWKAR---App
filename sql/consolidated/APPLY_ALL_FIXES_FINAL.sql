-- ========================================================
-- MASTER RELIABILITY FIX SCRIPT
-- Combines: Safe Bid Accept, Chat Triggers (Patched), and Data Repair
-- ========================================================

-- ========================================================
-- PART 1: SAFE ACCEPT BID RPC
-- Prevents race conditions and handles status updates atomically
-- ========================================================

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
DECLARE
  v_job_status TEXT;
  v_bid_status TEXT;
  v_bid_exists BOOLEAN;
BEGIN
  -- 1. LOCK the job row to prevent race conditions (Double Hire)
  SELECT status INTO v_job_status FROM jobs WHERE id = p_job_id FOR UPDATE;
  
  IF v_job_status IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_job_status != 'OPEN' THEN
    RAISE EXCEPTION 'Job is not open for bidding (current status: %)', v_job_status;
  END IF;

  -- 2. Verify Bid Status (Ghost Bid Check)
  SELECT status, TRUE INTO v_bid_status, v_bid_exists FROM bids WHERE id = p_bid_id;
  
  IF v_bid_exists IS NULL THEN
     RAISE EXCEPTION 'Bid not found (User may have withdrawn)';
  END IF;

  IF v_bid_status = 'REJECTED' THEN
     RAISE EXCEPTION 'Cannot accept a withdrawn/rejected bid.';
  END IF;

  -- 3. Update job status to IN_PROGRESS
  UPDATE jobs
  SET 
    status = 'IN_PROGRESS',
    accepted_bid_id = p_bid_id,
    updated_at = NOW()
  WHERE id = p_job_id;

  -- 4. Update accepted bid status
  UPDATE bids
  SET 
    status = 'ACCEPTED',
    updated_at = NOW()
  WHERE id = p_bid_id;

  -- 5. Reject all other PENDING bids
  UPDATE bids
  SET 
    status = 'REJECTED',
    updated_at = NOW()
  WHERE job_id = p_job_id 
    AND id != p_bid_id 
    AND status = 'PENDING';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Bid accepted successfully'
  );
END;
$$;


-- ============================================
-- PART 2: FIX CHAT TRIGGERS (FINAL CONSOLIDATION)
-- Patched to prioritize NEW.receiver_id
-- ============================================

-- Cleanup old triggers
DROP TRIGGER IF EXISTS trg_notify_on_new_message ON chat_messages;
DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON chat_messages;
DROP TRIGGER IF EXISTS on_chat_message_created ON chat_messages;
DROP TRIGGER IF EXISTS notify_chat_message ON chat_messages;
DROP FUNCTION IF EXISTS notify_on_new_message();

CREATE OR REPLACE FUNCTION notify_on_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_name TEXT;
  v_job_title TEXT;
  v_blocking_exists BOOLEAN;
BEGIN
  -- 1. Skip if message is soft-deleted
  IF NEW.is_deleted THEN
    RETURN NEW;
  END IF;

  -- 2. Identify Recipient
  -- PRIORITY: Use explicit receiver_id if available (supports pre-hire chat)
  IF NEW.receiver_id IS NOT NULL THEN
      v_recipient_id := NEW.receiver_id;
  ELSE
      -- FALLBACK: Infer from Job/Bid Logic (Legacy/Fallback)
      SELECT 
        CASE 
          WHEN NEW.sender_id = j.poster_id THEN b.worker_id 
          ELSE j.poster_id 
        END INTO v_recipient_id
      FROM jobs j
      LEFT JOIN bids b ON b.id = j.accepted_bid_id
      WHERE j.id = NEW.job_id;
  END IF;

  -- 3. Validate Recipient
  IF v_recipient_id IS NULL THEN
    RETURN NEW; 
  END IF;

  -- 4. Anti-Self-Notification
  IF v_recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  -- 5. BLOCKING CHECK
  SELECT EXISTS (
    SELECT 1 FROM user_blocks 
    WHERE blocker_id = v_recipient_id AND blocked_id = NEW.sender_id
  ) INTO v_blocking_exists;

  IF v_blocking_exists THEN
    RETURN NEW; -- Blocked, so silent
  END IF;

  -- 6. Get Metadata
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;

  -- 7. Insert Notification
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (
    v_recipient_id,
    'INFO',
    COALESCE(v_sender_name, 'Someone') || ' 💬',
    CASE 
      WHEN v_job_title IS NOT NULL THEN '"' || v_job_title || '": ' 
      ELSE '' 
    END || LEFT(NEW.text, 50) || CASE WHEN LENGTH(NEW.text) > 50 THEN '...' ELSE '' END,
    NEW.job_id,
    false,
    NOW()
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_on_chat_message
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION notify_on_chat_message();

-- ============================================
-- PART 3: DATA REPAIR (Broken Receivers)
-- ============================================

DO $$
DECLARE
    r_job RECORD;
    r_msg RECORD;
    v_worker_id UUID;
    v_poster_id UUID;
    v_updates INT := 0;
BEGIN
    -- Loop through all jobs that have an accepted bid
    FOR r_job IN 
        SELECT j.id, j.poster_id, b.worker_id 
        FROM jobs j
        JOIN bids b ON j.accepted_bid_id = b.id
        WHERE j.poster_id IS NOT NULL
    LOOP
        v_poster_id := r_job.poster_id;
        v_worker_id := r_job.worker_id;

        -- Loop through messages in this job
        FOR r_msg IN SELECT id, sender_id, receiver_id FROM chat_messages WHERE job_id = r_job.id
        LOOP
            -- Fix: If Sender is Poster, Receiver MUST be Worker
            IF r_msg.sender_id = v_poster_id AND (r_msg.receiver_id IS NULL OR r_msg.receiver_id != v_worker_id) THEN
                UPDATE chat_messages 
                SET receiver_id = v_worker_id 
                WHERE id = r_msg.id;
                v_updates := v_updates + 1;
            
            -- Fix: If Sender is Worker, Receiver MUST be Poster
            ELSIF r_msg.sender_id = v_worker_id AND (r_msg.receiver_id IS NULL OR r_msg.receiver_id != v_poster_id) THEN
                UPDATE chat_messages 
                SET receiver_id = v_poster_id 
                WHERE id = r_msg.id;
                v_updates := v_updates + 1;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✅ Repaired % chat messages.', v_updates;
END $$;
