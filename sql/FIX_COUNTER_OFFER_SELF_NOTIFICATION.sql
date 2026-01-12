-- ============================================
-- FIX COUNTER OFFER NOTIFICATION TRIGGER
-- ============================================
-- ISSUE: Worker is being notified when they send a counter offer
-- FIX: Only notify the OTHER party (not the one who countered)

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
  v_amount_changed BOOLEAN;
  v_last_negotiator_role TEXT;
  v_recipient_id UUID;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Check if negotiation_history changed (indicates counter offer)
  v_amount_changed := (NEW.amount != OLD.amount) OR (NEW.negotiation_history IS DISTINCT FROM OLD.negotiation_history);
  
  IF v_amount_changed AND NEW.status = 'PENDING' AND NEW.negotiation_history IS NOT NULL 
     AND jsonb_array_length(NEW.negotiation_history::jsonb) > 0 THEN
    
    -- Get job details
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    
    -- Get worker and poster names
    SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;
    SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
    
    -- Determine WHO made the last counter offer by checking negotiation_history
    v_last_negotiator_role := NEW.negotiation_history::jsonb->-1->>'by';
    
    -- CRITICAL: Only notify the OTHER party, not the one who countered
    IF v_last_negotiator_role = 'POSTER' THEN
      -- Poster countered → Notify WORKER
      v_recipient_id := NEW.worker_id;
      v_notification_title := 'Counter Offer Received 💸';
      v_notification_message := 'Employer countered with ₹' || NEW.amount || ' for "' || v_job.title || '".';
      
    ELSIF v_last_negotiator_role = 'WORKER' THEN
      -- Worker countered → Notify POSTER
      v_recipient_id := v_job.poster_id;
      v_notification_title := 'New Counter Offer 💰';
      v_notification_message := COALESCE(v_worker_name, 'Worker') || ' proposed ₹' || NEW.amount || ' for "' || v_job.title || '". Tap to respond!';
      
    ELSE
      -- Unknown negotiator, skip notification to prevent errors
      RAISE NOTICE '⚠️ Unknown negotiator role: %', v_last_negotiator_role;
      RETURN NEW;
    END IF;
    
    -- Send notification to the correct recipient
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
    
    RAISE NOTICE '✅ Counter offer notification sent from % to %', v_last_negotiator_role, v_recipient_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON bids;
CREATE TRIGGER trigger_notify_on_counter_offer
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_counter_offer();

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ COUNTER OFFER NOTIFICATION TRIGGER FIXED';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '- Checks negotiation_history to determine WHO countered';
  RAISE NOTICE '- If POSTER countered → Notifies WORKER';
  RAISE NOTICE '- If WORKER countered → Notifies POSTER';
  RAISE NOTICE '- No more self-notifications!';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT: Test by having a worker send a counter offer';
  RAISE NOTICE '================================================';
END $$;
