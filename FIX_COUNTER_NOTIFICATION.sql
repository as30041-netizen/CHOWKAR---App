-- ============================================
-- FIX: Counter Offer Notification Trigger
-- Notifies the CORRECT party based on who sent the counter
-- ============================================

-- Drop and recreate the trigger function with improved logic
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
  v_last_counter_by TEXT;
  v_recipient_id UUID;
  v_amount_changed BOOLEAN;
  v_history_length INT;
  v_old_history_length INT;
BEGIN
  -- Check if negotiation_history changed (indicates a counter offer)
  v_amount_changed := (NEW.amount != OLD.amount) OR (NEW.negotiation_history IS DISTINCT FROM OLD.negotiation_history);
  
  IF v_amount_changed AND NEW.status = 'PENDING' THEN
    -- Get job details
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    
    -- Get worker name
    SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;
    
    -- Get poster name
    SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
    
    -- Determine who sent the last counter by looking at the last entry
    v_history_length := COALESCE(jsonb_array_length(NEW.negotiation_history::jsonb), 0);
    v_old_history_length := COALESCE(jsonb_array_length(OLD.negotiation_history::jsonb), 0);
    
    -- Only notify if a new entry was added
    IF v_history_length > v_old_history_length AND v_history_length > 0 THEN
      -- Get the last counter's "by" field
      v_last_counter_by := NEW.negotiation_history::jsonb->(v_history_length - 1)->>'by';
      
      -- Determine recipient based on who sent the counter
      IF v_last_counter_by = 'POSTER' THEN
        -- Poster sent counter, notify Worker
        v_recipient_id := NEW.worker_id;
        INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
        VALUES (
          v_recipient_id,
          'INFO',
          'Counter Offer',
          'Customer offered ₹' || NEW.amount || ' for "' || v_job.title || '"',
          NEW.job_id,
          false,
          NOW()
        );
        RAISE NOTICE '✅ Counter offer notification sent to worker %', v_recipient_id;
        
      ELSIF v_last_counter_by = 'WORKER' THEN
        -- Worker sent counter, notify Poster
        v_recipient_id := v_job.poster_id;
        INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
        VALUES (
          v_recipient_id,
          'INFO',
          'Counter Offer',
          COALESCE(v_worker_name, 'Worker') || ' countered ₹' || NEW.amount || ' for "' || v_job.title || '"',
          NEW.job_id,
          false,
          NOW()
        );
        RAISE NOTICE '✅ Counter offer notification sent to poster %', v_recipient_id;
        
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger (safe - drops if exists first)
DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON bids;
CREATE TRIGGER trigger_notify_on_counter_offer
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_counter_offer();

-- Verify trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname = 'trigger_notify_on_counter_offer';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Counter offer trigger updated successfully!';
  RAISE NOTICE 'Now supports bidirectional notifications:';
  RAISE NOTICE '  - Poster counter → Worker gets notified';
  RAISE NOTICE '  - Worker counter → Poster gets notified';
END $$;
