-- ============================================
-- COMPLETE COUNTER OFFER TRIGGER CLEANUP & FIX
-- ============================================
-- Problem: Multiple triggers exist, some on INSERT instead of UPDATE
-- Solution: Drop ALL counter triggers and create ONE correct UPDATE trigger

-- ============================================
-- STEP 1: FORCE DROP ALL COUNTER TRIGGERS
-- ============================================

-- Drop by specific names we see in the database
DROP TRIGGER IF EXISTS on_bid_counter_notify ON bids CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON bids CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer_v2 ON bids CASCADE;
DROP TRIGGER IF EXISTS on_counter_offer_notify ON bids CASCADE;
DROP TRIGGER IF EXISTS notify_counter_offer ON bids CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_on_bid_negotiation ON bids CASCADE;

-- Drop the old function
DROP FUNCTION IF EXISTS notify_on_counter_offer() CASCADE;
DROP FUNCTION IF EXISTS notify_on_counter_offer_v2() CASCADE;

-- ============================================
-- STEP 2: CREATE THE CORRECT UPDATE TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_counter_offer_final()
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
  -- Debug logging
  RAISE NOTICE '[Counter] Trigger fired for bid %', NEW.id;
  
  -- Check if negotiation_history grew (indicates a new counter)
  v_old_history_length := COALESCE(jsonb_array_length(OLD.negotiation_history::jsonb), 0);
  v_history_length := COALESCE(jsonb_array_length(NEW.negotiation_history::jsonb), 0);
  
  RAISE NOTICE '[Counter] History: OLD=%, NEW=%', v_old_history_length, v_history_length;
  
  -- Only proceed if history grew (new counter was added)
  IF v_history_length <= v_old_history_length THEN
    RAISE NOTICE '[Counter] SKIP: No new counter (history did not grow)';
    RETURN NEW;
  END IF;
  
  -- Only proceed for PENDING bids
  IF NEW.status != 'PENDING' THEN
    RAISE NOTICE '[Counter] SKIP: Status is % (not PENDING)', NEW.status;
    RETURN NEW;
  END IF;
  
  -- Get job and names
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;
  SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
  
  -- Extract WHO sent the counter
  v_last_negotiator_role := NEW.negotiation_history::jsonb->-1->>'by';
  
  RAISE NOTICE '[Counter] Negotiator role: "%"', v_last_negotiator_role;
  RAISE NOTICE '[Counter] Worker ID: %, Poster ID: %', NEW.worker_id, v_job.poster_id;
  
  -- Determine recipient: OPPOSITE of who sent it
  IF v_last_negotiator_role = 'POSTER' THEN
    -- Poster sent counter → Notify WORKER
    v_recipient_id := NEW.worker_id;
    v_notification_title := 'Counter Offer Received 💸';
    v_notification_message := 'Employer countered with ₹' || NEW.amount || ' for "' || v_job.title || '".';
    RAISE NOTICE '[Counter] → Notifying WORKER %', v_recipient_id;
    
  ELSIF v_last_negotiator_role = 'WORKER' THEN
    -- Worker sent counter → Notify POSTER
    v_recipient_id := v_job.poster_id;
    v_notification_title := 'New Counter Offer 💰';
    v_notification_message := COALESCE(v_worker_name, 'Worker') || ' proposed ₹' || NEW.amount || ' for "' || v_job.title || '". Tap to respond!';
    RAISE NOTICE '[Counter] → Notifying POSTER %', v_recipient_id;
    
  ELSE
    RAISE NOTICE '[Counter] ERROR: Unknown role "%"', v_last_negotiator_role;
    RETURN NEW;
  END IF;
  
  -- Send notification
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (v_recipient_id, 'INFO', v_notification_title, v_notification_message, NEW.job_id, false, NOW());
  
  RAISE NOTICE '[Counter] ✅ Notification sent to %', v_recipient_id;
  
  RETURN NEW;
END;
$$;

-- Create the trigger - CRITICAL: Use AFTER UPDATE, not INSERT
CREATE TRIGGER trigger_counter_offer_final
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_counter_offer_final();

-- ============================================
-- STEP 3: VERIFY CLEANUP
-- ============================================

DO $$
DECLARE
  counter_trigger_count INTEGER;
  all_trigger_count INTEGER;
BEGIN
  -- Count counter-related triggers
  SELECT COUNT(*) INTO counter_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'bids'::regclass
    AND tgname LIKE '%counter%';
  
  -- Count all triggers on bids
  SELECT COUNT(*) INTO all_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'bids'::regclass;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '✅ COUNTER OFFER TRIGGER - FINAL VERSION';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Counter triggers: %', counter_trigger_count;
  RAISE NOTICE 'Total triggers on bids: %', all_trigger_count;
  
  IF counter_trigger_count = 1 THEN
    RAISE NOTICE '✅ PERFECT: Exactly 1 counter trigger exists';
  ELSIF counter_trigger_count = 0 THEN
    RAISE NOTICE '❌ ERROR: No counter triggers found!';
  ELSE
    RAISE NOTICE '⚠️  WARNING: % counter triggers (should be 1)', counter_trigger_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Key Changes:';
  RAISE NOTICE '  1. ✅ Removed ALL old INSERT triggers';
  RAISE NOTICE '  2. ✅ Created ONE UPDATE trigger';
  RAISE NOTICE '  3. ✅ Checks negotiation_history growth';
  RAISE NOTICE '  4. ✅ Identifies POSTER vs WORKER correctly';
  RAISE NOTICE '  5. ✅ Notifies the OPPOSITE party (no self-notify)';
  RAISE NOTICE '';
  RAISE NOTICE 'TESTING:';
  RAISE NOTICE '  • Worker sends counter → Poster gets notified';
  RAISE NOTICE '  • Poster sends counter → Worker gets notified';
  RAISE NOTICE '  • Only ONE notification per counter';
  RAISE NOTICE '═══════════════════════════════════════════════';
END $$;

-- List all remaining triggers on bids table
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END as timing,
  CASE 
    WHEN t.tgtype & 64 = 64 THEN 'INSERT'
    WHEN t.tgtype & 32 = 32 THEN 'DELETE'
    WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
  END as event
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'bids'::regclass
ORDER BY t.tgname;
