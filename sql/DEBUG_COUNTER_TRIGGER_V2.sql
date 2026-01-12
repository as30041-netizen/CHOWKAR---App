-- ============================================
-- DEBUG AND FIX COUNTER OFFER TRIGGER
-- ============================================
-- Issue: Worker still receives "Counter Offer Received" when they send counter
-- This means the trigger is not correctly reading the negotiation_history

-- ============================================
-- STEP 1: CHECK CURRENT TRIGGER STATUS
-- ============================================

-- List all triggers on bids table
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE 
    WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
    WHEN t.tgtype & 4 = 4 THEN 'AFTER'
  END as timing,
  CASE
    WHEN t.tgtype & 16 = 16 THEN 'INSERT'
    WHEN t.tgtype & 8 = 8 THEN 'DELETE'  
    WHEN t.tgtype & 4 = 4 THEN 'UPDATE'
  END as event
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'bids'::regclass
ORDER BY t.tgname;

-- ============================================
-- STEP 2: DROP ALL COUNTER-RELATED TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON bids CASCADE;
DROP TRIGGER IF EXISTS on_counter_offer_notify ON bids CASCADE;
DROP TRIGGER IF EXISTS notify_counter_offer ON bids CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_on_bid_negotiation ON bids CASCADE;
DROP FUNCTION IF EXISTS notify_on_counter_offer() CASCADE;

-- ============================================
-- STEP 3: CREATE NEW ROBUST TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_counter_offer_v2()
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
  -- Extensive debug logging
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '[Counter] Trigger fired for bid %', NEW.id;
  
  -- Check if negotiation_history exists and grew
  v_old_history_length := COALESCE(jsonb_array_length(OLD.negotiation_history::jsonb), 0);
  v_history_length := COALESCE(jsonb_array_length(NEW.negotiation_history::jsonb), 0);
  
  RAISE NOTICE '[Counter] History lengths: OLD=%, NEW=%', v_old_history_length, v_history_length;
  
  -- Only proceed if history actually grew (new counter added)
  IF v_history_length <= v_old_history_length THEN
    RAISE NOTICE '[Counter] ⏭️  SKIP: History did not grow';
    RETURN NEW;
  END IF;
  
  -- Only proceed if status is PENDING
  IF NEW.status != 'PENDING' THEN
    RAISE NOTICE '[Counter] ⏭️  SKIP: Status is % (not PENDING)', NEW.status;
    RETURN NEW;
  END IF;
  
  -- Get job details
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  IF NOT FOUND THEN
    RAISE NOTICE '[Counter] ⚠️  ERROR: Job % not found', NEW.job_id;
    RETURN NEW;
  END IF;
  
  -- Get names
  SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;
  SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
  
  RAISE NOTICE '[Counter] Job: % (Poster: %, Worker: %)', v_job.title, v_poster_name, v_worker_name;
  
  -- Extract WHO made the latest counter
  -- IMPORTANT: The 'by' field should be 'POSTER' or 'WORKER' (UserRole enum)
  v_last_negotiator_role := NEW.negotiation_history::jsonb->-1->>'by';
  
  RAISE NOTICE '[Counter] Last negotiator role from history: "%"', v_last_negotiator_role;
  RAISE NOTICE '[Counter] Full last entry: %', NEW.negotiation_history::jsonb->-1;
  
  -- Determine recipient based on WHO countered
  -- CRITICAL: If WORKER countered, notify POSTER (not worker!)
  --           If POSTER countered, notify WORKER (not poster!)
  
  IF v_last_negotiator_role = 'POSTER' THEN
    -- Poster sent the counter → Notify WORKER
    v_recipient_id := NEW.worker_id;
    v_notification_title := 'Counter Offer Received 💸';
    v_notification_message := 'Employer countered with ₹' || NEW.amount || ' for "' || v_job.title || '".';
    
    RAISE NOTICE '[Counter] 📤 POSTER countered → Notifying WORKER (ID: %)', v_recipient_id;
    
  ELSIF v_last_negotiator_role = 'WORKER' THEN
    -- Worker sent the counter → Notify POSTER  
    v_recipient_id := v_job.poster_id;
    v_notification_title := 'New Counter Offer 💰';
    v_notification_message := COALESCE(v_worker_name, 'Worker') || ' proposed ₹' || NEW.amount || ' for "' || v_job.title || '". Tap to respond!';
    
    RAISE NOTICE '[Counter] 📤 WORKER countered → Notifying POSTER (ID: %)', v_recipient_id;
    
  ELSE
    -- Unknown or missing 'by' field
    RAISE NOTICE '[Counter] ❌ ERROR: Unknown negotiator role "%". Cannot send notification.', v_last_negotiator_role;
    RAISE NOTICE '[Counter] This usually means the frontend is not setting the "by" field correctly.';
    RETURN NEW;
  END IF;
  
  -- Validate recipient ID before inserting
  IF v_recipient_id IS NULL THEN
    RAISE NOTICE '[Counter] ❌ ERROR: Recipient ID is NULL. Cannot send notification.';
    RETURN NEW;
  END IF;
  
  -- Send notification
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
  
  RAISE NOTICE '[Counter] ✅ SUCCESS: Notification sent to user %', v_recipient_id;
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '';
  
  RETURN NEW;
END;
$$;

-- ============================================
-- STEP 4: CREATE TRIGGER
-- ============================================

CREATE TRIGGER trigger_notify_on_counter_offer_v2
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_counter_offer_v2();

-- ============================================
-- STEP 5: VERIFY
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
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '✅ COUNTER OFFER TRIGGER V2 INSTALLED';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Counter triggers found: %', trigger_count;
  
  IF trigger_count = 1 THEN
    RAISE NOTICE '✅ GOOD: Exactly 1 counter trigger exists';
  ELSE
    RAISE NOTICE '⚠️  WARNING: % counter triggers found', trigger_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'This V2 trigger includes:';
  RAISE NOTICE '  • Extensive debug logging';
  RAISE NOTICE '  • Validation of negotiation_history format';
  RAISE NOTICE '  • Clear indication of WHO is being notified';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Test by sending a counter offer from worker';
  RAISE NOTICE '2. Check Supabase logs to see the debug output';
  RAISE NOTICE '3. Verify ONLY the poster gets notified (not worker)';
  RAISE NOTICE '════════════════════════════════════════';
END $$;
