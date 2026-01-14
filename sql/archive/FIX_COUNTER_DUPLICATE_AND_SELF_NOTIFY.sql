-- ============================================
-- DIAGNOSE AND FIX COUNTER OFFER ISSUES
-- ============================================
-- Issues:
-- 1. Duplicate notifications (2 notifications for same counter)
-- 2. Wrong self-notification (worker gets "employer countered" when worker sent counter)
-- 3. UI shows wrong turn indicator

-- ============================================
-- STEP 1: CHECK FOR DUPLICATE TRIGGERS
-- ============================================

DO $$
DECLARE
  trigger_count INTEGER;
  trigger_name TEXT;
  function_name TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '🔍 CHECKING FOR DUPLICATE TRIGGERS';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  
  -- Check how many triggers exist on bids table for UPDATE
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'bids'::regclass
    AND tgtype & 4 = 4; -- UPDATE triggers
  
  RAISE NOTICE 'Total UPDATE triggers on bids table: %', trigger_count;
  
  -- List all triggers
  FOR trigger_name, function_name IN 
    SELECT t.tgname, p.proname
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE tgrelid = 'bids'::regclass
      AND tgtype & 4 = 4
  LOOP
    RAISE NOTICE '  - %: %', trigger_name, function_name;
  END LOOP;
  
  RAISE NOTICE '';
END $$;

-- ============================================
-- STEP 2: DROP ALL OLD COUNTER OFFER TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON bids;
DROP TRIGGER IF EXISTS on_counter_offer_notify ON bids;
DROP TRIGGER IF EXISTS notify_counter_offer ON bids;
DROP TRIGGER IF EXISTS trigger_notify_on_bid_negotiation ON bids;

-- ============================================
-- STEP 3: CREATE FIXED COUNTER OFFER FUNCTION
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
  v_poster_name TEXT;
  v_last_negotiator_role TEXT;
  v_recipient_id UUID;
  v_notification_title TEXT;
  v_notification_message TEXT;
  v_history_length INTEGER;
  v_old_history_length INTEGER;
BEGIN
  -- Debug log
  RAISE NOTICE '[Counter] Trigger fired for bid %', NEW.id;
  
  -- Only proceed if negotiation_history actually changed
  v_history_length := COALESCE(jsonb_array_length(NEW.negotiation_history::jsonb), 0);
  v_old_history_length := COALESCE(jsonb_array_length(OLD.negotiation_history::jsonb), 0);
  
  -- Check if this is genuinely a new counter (history grew)
  IF v_history_length <= v_old_history_length OR v_history_length = 0 THEN
    RAISE NOTICE '[Counter] Skip: history did not grow (old=%, new=%)', v_old_history_length, v_history_length;
    RETURN NEW;
  END IF;
  
  -- Only process if status is PENDING
  IF NEW.status != 'PENDING' THEN
    RAISE NOTICE '[Counter] Skip: status is not PENDING (status=%)', NEW.status;
    RETURN NEW;
  END IF;
  
  -- Get job details
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  
  -- Get names
  SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;
  SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
  
  -- Extract WHO made the latest counter from negotiation_history
  v_last_negotiator_role := NEW.negotiation_history::jsonb->-1->>'by';
  
  RAISE NOTICE '[Counter] Latest counter by: %', v_last_negotiator_role;
  
  -- Determine recipient based on WHO countered
  IF v_last_negotiator_role = 'POSTER' THEN
    -- Poster countered → Notify WORKER
    v_recipient_id := NEW.worker_id;
    v_notification_title := 'Counter Offer Received 💸';
    v_notification_message := 'Employer countered with ₹' || NEW.amount || ' for "' || v_job.title || '".';
    
    RAISE NOTICE '[Counter] POSTER countered → notifying WORKER %', v_recipient_id;
    
  ELSIF v_last_negotiator_role = 'WORKER' THEN
    -- Worker countered → Notify POSTER
    v_recipient_id := v_job.poster_id;
    v_notification_title := 'New Counter Offer 💰';
    v_notification_message := COALESCE(v_worker_name, 'Worker') || ' proposed ₹' || NEW.amount || ' for "' || v_job.title || '". Tap to respond!';
    
    RAISE NOTICE '[Counter] WORKER countered → notifying POSTER %', v_recipient_id;
    
  ELSE
    -- Unknown role - skip to prevent errors
    RAISE NOTICE '[Counter] Unknown negotiator role: %. Skipping notification.', v_last_negotiator_role;
    RETURN NEW;
  END IF;
  
  -- Send notification to correct recipient
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (
    v_recipient_id,
    'INFO',
    v_notification_title,
    v_notification_message,
    NEW.job_id,
    false,
    NOW()
  );
  
  RAISE NOTICE '[Counter] ✅ Notification sent to %', v_recipient_id;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- STEP 4: CREATE TRIGGER (ONLY ONE)
-- ============================================

CREATE TRIGGER trigger_notify_on_counter_offer
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_counter_offer();

-- ============================================
-- STEP 5: VERIFY SINGLE TRIGGER EXISTS
-- ============================================

DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'bids'::regclass
    AND tgname LIKE '%counter%';
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ COUNTER OFFER TRIGGER FIXED';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Counter-related triggers on bids: %', trigger_count;
  
  IF trigger_count = 1 THEN
    RAISE NOTICE '✅ GOOD: Only 1 counter trigger exists';
  ELSE
    RAISE NOTICE '⚠️  WARNING: % counter triggers found (should be 1)', trigger_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Fixes Applied:';
  RAISE NOTICE '1. ✅ Removed all duplicate counter triggers';
  RAISE NOTICE '2. ✅ Checks negotiation_history growth to prevent re-triggering';
  RAISE NOTICE '3. ✅ Correctly identifies WHO sent counter (POSTER vs WORKER)';
  RAISE NOTICE '4. ✅ Only notifies the OTHER party (no self-notifications)';
  RAISE NOTICE '5. ✅ Added debug logging for troubleshooting';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT: Test by:';
  RAISE NOTICE '  1. Worker sends counter → Poster should get notified (not worker)';
  RAISE NOTICE '  2. Poster sends counter → Worker should get notified (not poster)';
  RAISE NOTICE '  3. Each party should receive ONLY 1 notification per counter';
  RAISE NOTICE '================================================';
END $$;
