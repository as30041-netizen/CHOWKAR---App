-- ============================================
-- FIX CHAT TRIGGERS (FINAL CONSOLIDATION)
-- ============================================
-- 1. Drops all known duplicate/conflicting chat triggers.
-- 2. Installs a SINGLE, canonical trigger for chat notifications.
-- 3. Ensures notifications respect blocking and job status.

-- ============================================
-- STEP 1: CLEANUP OLD TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS trg_notify_on_new_message ON chat_messages;
DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON chat_messages;
DROP TRIGGER IF EXISTS on_chat_message_created ON chat_messages;
DROP TRIGGER IF EXISTS notify_chat_message ON chat_messages;

-- Drop the V2 function to avoid confusion (we use the 'complete' one)
DROP FUNCTION IF EXISTS notify_on_new_message();

-- ============================================
-- STEP 2: CREATE CANONICAL NOTIFICATION FUNCTION
-- ============================================

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

  -- 2. Identify Recipient (Poster <-> Worker)
  -- Logic: 
  --   If Sender is Poster -> Recipient is Worker (from accepted bid)
  --   If Sender is Worker -> Recipient is Poster
  --   Fallback/Rescue: Look at who is NOT the sender in the job context
  SELECT 
    CASE 
      WHEN NEW.sender_id = j.poster_id THEN b.worker_id 
      ELSE j.poster_id 
    END INTO v_recipient_id
  FROM jobs j
  LEFT JOIN bids b ON b.id = j.accepted_bid_id
  WHERE j.id = NEW.job_id;

  -- 3. Validate Recipient
  IF v_recipient_id IS NULL THEN
    -- Debug log?
    -- RAISE NOTICE 'No recipient found for job %', NEW.job_id;
    RETURN NEW; 
  END IF;

  -- 4. Anti-Self-Notification (Double Check)
  IF v_recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  -- 5. BLOCKING CHECK (Don't notify if recipient has blocked sender)
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
  -- This insert will cascade into the Push Notification trigger (if enabled)
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

-- ============================================
-- STEP 3: CREATE SINGLE TRIGGER
-- ============================================

CREATE TRIGGER trigger_notify_on_chat_message
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION notify_on_chat_message();

-- ============================================
-- STEP 4: VERIFY
-- ============================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_trigger
  WHERE tgrelid = 'chat_messages'::regclass
    AND tgtype & 4 = 4; -- INSERT

  RAISE NOTICE 'Total INSERT triggers on chat_messages: % (Should be 1)', v_count;
  
  IF v_count = 1 THEN
     RAISE NOTICE '✅ SUCCESS: Chat triggers consolidated.';
  ELSE
     RAISE NOTICE '⚠️ WARNING: Still have % triggers. Run DIAGNOSE_CHAT_TRIGGERS.sql to list them.', v_count;
  END IF;
END $$;
