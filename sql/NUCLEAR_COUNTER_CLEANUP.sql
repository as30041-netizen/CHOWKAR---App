-- ============================================
-- NUCLEAR OPTION: DROP ALL COUNTER TRIGGERS AND FUNCTIONS
-- ============================================

-- Drop ALL counter-related triggers on bids table
DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  FOR trigger_record IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'bids'::regclass 
      AND tgname LIKE '%counter%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON bids CASCADE', trigger_record.tgname);
    RAISE NOTICE 'Dropped trigger: %', trigger_record.tgname;
  END LOOP;
END $$;

-- Drop ALL counter-related functions
DROP FUNCTION IF EXISTS notify_worker_on_counter() CASCADE;
DROP FUNCTION IF EXISTS notify_on_counter_offer() CASCADE;
DROP FUNCTION IF EXISTS notify_on_counter_offer_v2() CASCADE;
DROP FUNCTION IF EXISTS notify_on_counter_offer_final() CASCADE;
DROP FUNCTION IF EXISTS on_bid_counter_notify() CASCADE;

-- ============================================
-- CREATE SINGLE, CLEAN COUNTER TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION handle_counter_offer_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_worker_name TEXT;
  v_last_negotiator TEXT;
  v_recipient_id UUID;
  v_notification_title TEXT;
  v_notification_message TEXT;
  v_new_history_length INTEGER;
  v_old_history_length INTEGER;
BEGIN
  RAISE NOTICE '[CounterOffer] Trigger START for bid %', NEW.id;
  
  -- Check if negotiation_history grew
  v_old_history_length := COALESCE(jsonb_array_length(OLD.negotiation_history::jsonb), 0);
  v_new_history_length := COALESCE(jsonb_array_length(NEW.negotiation_history::jsonb), 0);
  
  -- Only proceed if history grew (new counter added)
  IF v_new_history_length <= v_old_history_length THEN
    RAISE NOTICE '[CounterOffer] SKIP: No new counter added';
    RETURN NEW;
  END IF;
  
  -- Only for PENDING bids
  IF NEW.status != 'PENDING' THEN
    RAISE NOTICE '[CounterOffer] SKIP: Status is %', NEW.status;
    RETURN NEW;
  END IF;
  
  -- Get job info
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;
  
  -- WHO sent the counter?
  v_last_negotiator := NEW.negotiation_history::jsonb->-1->>'by';
  
  RAISE NOTICE '[CounterOffer] Last negotiator: "%", Worker: %, Poster: %', 
    v_last_negotiator, NEW.worker_id, v_job.poster_id;
  
  -- Send to the OPPOSITE party
  IF v_last_negotiator = 'POSTER' THEN
    -- Poster countered → Notify WORKER
    v_recipient_id := NEW.worker_id;
    v_notification_title := 'Counter Offer Received 💸';
    v_notification_message := 'Employer countered with ₹' || NEW.amount || ' for "' || v_job.title || '".';
    RAISE NOTICE '[CounterOffer] POSTER → WORKER notification';
    
  ELSIF v_last_negotiator = 'WORKER' THEN
    -- Worker countered → Notify POSTER
    v_recipient_id := v_job.poster_id;
    v_notification_title := 'New Counter Offer 💰';
    v_notification_message := COALESCE(v_worker_name, 'Worker') || ' proposed ₹' || NEW.amount || ' for "' || v_job.title || '". Tap to respond!';
    RAISE NOTICE '[CounterOffer] WORKER → POSTER notification';
    
  ELSE
    RAISE NOTICE '[CounterOffer] ERROR: Unknown negotiator "%"', v_last_negotiator;
    RETURN NEW;
  END IF;
  
  -- Insert notification
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (v_recipient_id, 'INFO', v_notification_title, v_notification_message, NEW.job_id, false, NOW());
  
  RAISE NOTICE '[CounterOffer] ✅ Sent to user %', v_recipient_id;
  RAISE NOTICE '[CounterOffer] END';
  
  RETURN NEW;
END;
$$;

-- Create single trigger
CREATE TRIGGER counter_offer_notification_trigger
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION handle_counter_offer_notification();

-- ============================================
-- VERIFY
-- ============================================

DO $$
DECLARE
  counter_trigger_count INTEGER;
  counter_function_count INTEGER;
BEGIN
  -- Count triggers
  SELECT COUNT(*) INTO counter_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'bids'::regclass AND tgname LIKE '%counter%';
  
  -- Count functions
  SELECT COUNT(*) INTO counter_function_count
  FROM pg_proc
  WHERE proname LIKE '%counter%' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '✅ COUNTER OFFER SYSTEM - CLEAN INSTALL';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Counter triggers on bids: %', counter_trigger_count;
  RAISE NOTICE 'Counter functions: %', counter_function_count;
  RAISE NOTICE '';
  
  IF counter_trigger_count = 1 AND counter_function_count = 1 THEN
    RAISE NOTICE '✅✅✅ PERFECT: 1 trigger + 1 function';
  ELSE
    RAISE NOTICE '⚠️  Multiple triggers/functions still exist!';
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════';
END $$;

-- Show what remains
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'bids'::regclass
  AND tgname LIKE '%counter%';
