-- ============================================
-- COMPLETE NOTIFICATION TRIGGERS
-- All missing triggers for comprehensive user journey
-- ============================================

-- ============================================
-- TRIGGER 1: Notify on Bid Accept (CRITICAL!)
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_bid_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_worker_name TEXT;
  v_poster_name TEXT;
  v_bid_amount INTEGER;
BEGIN
  -- Only proceed if bid was just accepted (status changed to ACCEPTED)
  IF NEW.status = 'ACCEPTED' AND (OLD.status IS NULL OR OLD.status != 'ACCEPTED') THEN
    
    -- Get job details
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    
    -- Get worker name
    SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;
    
    -- Get poster name
    SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
    
    -- Notify ACCEPTED worker (do NOT mention payment - handled separately)
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      NEW.worker_id,
      'SUCCESS',
      'You Got the Job! 🎉',
      COALESCE(v_poster_name, 'Employer') || ' selected you for "' || v_job.title || '" at ₹' || NEW.amount || '. Tap to proceed!',
      NEW.job_id,
      false,
      NOW()
    );
    
    RAISE NOTICE '✅ Acceptance notification sent to worker %', NEW.worker_id;
    
    -- Notify all OTHER bidders that job is filled
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    SELECT 
      worker_id,
      'INFO',
      'Job Update',
      'Another worker was selected for "' || v_job.title || '". Keep bidding on other jobs!',
      NEW.job_id,
      false,
      NOW()
    FROM bids
    WHERE job_id = NEW.job_id 
      AND worker_id != NEW.worker_id
      AND status = 'PENDING';
    
    RAISE NOTICE '✅ Rejection notifications sent to other bidders';
    
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_bid_accept ON bids;
CREATE TRIGGER trigger_notify_on_bid_accept
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_bid_accept();

-- ============================================
-- TRIGGER 2: Notify on Counter Offer
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_counter_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_worker_name TEXT;
  v_amount_changed BOOLEAN;
BEGIN
  -- Check if negotiation_history changed (indicates counter offer)
  v_amount_changed := (NEW.amount != OLD.amount) OR (NEW.negotiation_history != OLD.negotiation_history);
  
  IF v_amount_changed AND NEW.status = 'PENDING' THEN
    -- Get job details
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    
    -- Get worker name
    SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;
    
    -- Notify worker of counter offer
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      NEW.worker_id,
      'INFO',
      'Counter Offer',
      'Customer offered ₹' || NEW.amount || ' for "' || v_job.title || '"',
      NEW.job_id,
      false,
      NOW()
    );
    
    RAISE NOTICE '✅ Counter offer notification sent to worker %', NEW.worker_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON bids;
CREATE TRIGGER trigger_notify_on_counter_offer
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_counter_offer();

-- ============================================
-- TRIGGER 3: Notify on Job Completion (CRITICAL!)
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_job_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID;
  v_bid_amount INTEGER;
  v_worker_name TEXT;
BEGIN
  -- Only proceed if job was just completed
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
    
    -- Get accepted bid details
    SELECT worker_id, amount INTO v_worker_id, v_bid_amount
    FROM bids
    WHERE id = NEW.accepted_bid_id;
    
    IF v_worker_id IS NOT NULL THEN
      -- Get worker name
      SELECT name INTO v_worker_name FROM profiles WHERE id = v_worker_id;
      
      -- Notify worker that job is complete with job context
      INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
      VALUES (
        v_worker_id,
        'SUCCESS',
        'Job Completed! 💰',
        'Great work on "' || NEW.title || '"! ₹' || v_bid_amount || ' has been credited to your wallet.',
        NEW.id,
        false,
        NOW()
      );
      
      RAISE NOTICE '✅ Completion notification sent to worker %', v_worker_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_job_completion ON jobs;
CREATE TRIGGER trigger_notify_on_job_completion
AFTER UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION notify_on_job_completion();

-- ============================================
-- TRIGGER 4: Notify on Review Received
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer_name TEXT;
  v_job_title TEXT;
BEGIN
  -- Get reviewer name
  SELECT name INTO v_reviewer_name FROM profiles WHERE id = NEW.reviewer_id;
  
  -- Get job title if available
  IF NEW.job_id IS NOT NULL THEN
    SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;
  END IF;
  
  -- Notify person being reviewed with clear context
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (
    NEW.reviewee_id,
    'SUCCESS',
    'New Review ⭐',
    COALESCE(v_reviewer_name, 'Someone') || ' gave you ' || NEW.rating || ' stars' || 
    CASE WHEN v_job_title IS NOT NULL THEN ' for "' || v_job_title || '"' ELSE '' END || '. Tap to view!',
    NEW.job_id,
    false,
    NOW()
  );
  
  RAISE NOTICE '✅ Review notification sent to user %', NEW.reviewee_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_review ON reviews;
CREATE TRIGGER trigger_notify_on_review
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION notify_on_review();

-- ============================================
-- TRIGGER 5: Notify on Chat Message
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_sender_name TEXT;
  v_recipient_id UUID;
  v_message_preview TEXT;
BEGIN
  -- Get job details
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  
  -- Get sender name
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  
  -- Determine recipient (poster or accepted worker)
  IF NEW.sender_id = v_job.poster_id THEN
    -- Sender is poster, recipient is worker
    SELECT worker_id INTO v_recipient_id FROM bids WHERE id = v_job.accepted_bid_id;
  ELSE
    -- Sender is worker, recipient is poster
    v_recipient_id := v_job.poster_id;
  END IF;
  
  IF v_recipient_id IS NOT NULL THEN
    -- Create message preview (first 50 chars)
    v_message_preview := LEFT(NEW.text, 50);
    IF LENGTH(NEW.text) > 50 THEN
      v_message_preview := v_message_preview || '...';
    END IF;
    
    -- Notify recipient with sender name and job context
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      v_recipient_id,
      'INFO',
      COALESCE(v_sender_name, 'Someone') || ' 💬',
      '\"' || v_job.title || '\": ' || v_message_preview,
      NEW.job_id,
      false,
      NOW()
    );
    
    RAISE NOTICE '✅ Message notification sent to user %', v_recipient_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON chat_messages;
CREATE TRIGGER trigger_notify_on_chat_message
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION notify_on_chat_message();

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all triggers exist
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name,
  '✅ Active' as status
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname IN (
  'on_bid_created_notify',
  'trigger_notify_on_bid_accept',
  'trigger_notify_on_counter_offer',
  'trigger_notify_on_job_completion',
  'trigger_notify_on_review',
  'trigger_notify_on_chat_message'
)
ORDER BY tgrelid, tgname;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ ALL NOTIFICATION TRIGGERS CREATED';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Triggers Created:';
  RAISE NOTICE '1. ✅ on_bid_created_notify - New bid placed';
  RAISE NOTICE '2. ✅ trigger_notify_on_bid_accept - Bid accepted/rejected';
  RAISE NOTICE '3. ✅ trigger_notify_on_counter_offer - Counter offer sent';
  RAISE NOTICE '4. ✅ trigger_notify_on_job_completion - Job completed';
  RAISE NOTICE '5. ✅ trigger_notify_on_review - Review received';
  RAISE NOTICE '6. ✅ trigger_notify_on_chat_message - New message';
  RAISE NOTICE '';
  RAISE NOTICE 'These triggers will:';
  RAISE NOTICE '- Create notifications in database';
  RAISE NOTICE '- Real-time broadcasts will deliver instantly';
  RAISE NOTICE '- Edge function will send push notifications';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT: Run FIX_BIDDING_DATABASE.sql for realtime';
  RAISE NOTICE '================================================';
END $$;
