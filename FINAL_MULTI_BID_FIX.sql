-- ============================================
-- FINAL MULTI-BIDDER & NOTIFICATION FIX
-- Consolidates RLS Safety and Correct Notification Logic
-- ============================================

-- 1. FIX BIDS RLS (Ensure Safety)
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert bids" ON bids;
CREATE POLICY "Users can insert bids"
ON bids FOR INSERT
WITH CHECK (
  auth.uid() = worker_id 
  AND NOT EXISTS (SELECT 1 FROM jobs WHERE id = job_id AND poster_id = auth.uid())
  AND EXISTS (SELECT 1 FROM jobs WHERE id = job_id AND status = 'OPEN') -- Critical Safety Check
);

-- 2. FIX COUNTER OFFER NOTIFICATION (Ensure Correct Sender Name)
-- Previous version might have hardcoded "Customer offered"
CREATE OR REPLACE FUNCTION notify_on_counter_offer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
  v_job RECORD;
  v_last_entry JSONB;
  v_last_by TEXT;
  v_recipient_id UUID;
  v_counter_name TEXT;
BEGIN
  -- Only proceed if amount or negotiation history changed
  IF (NEW.amount != OLD.amount OR NEW.negotiation_history != OLD.negotiation_history) AND NEW.status = 'PENDING' THEN
     SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
     
     -- Get the LAST entry from negotiation_history
     -- history format: [{amount: 100, by: 'WORKER', timestamp: ...}]
     v_last_entry := NEW.negotiation_history->-1;
     v_last_by := v_last_entry->>'by';
     
     -- Determine who to notify
     IF v_last_by = 'POSTER' THEN
       v_recipient_id := NEW.worker_id;
       v_counter_name := 'Employer'; -- "Customer" -> "Employer" for better context
     ELSIF v_last_by = 'WORKER' THEN
       v_recipient_id := v_job.poster_id;
       SELECT name INTO v_counter_name FROM profiles WHERE id = NEW.worker_id;
     ELSE
       RETURN NEW; -- Skip if unknown
     END IF;
     
     -- Send notification
     INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
     VALUES (
       v_recipient_id, 
       'INFO', 
       'Counter Offer 💬', 
       COALESCE(v_counter_name, 'Someone') || ' countered with ₹' || NEW.amount || ' for "' || v_job.title || '"', 
       NEW.job_id, 
       false, 
       NOW()
     );
  END IF;
  RETURN NEW;
END;
$$;

-- Refesh the trigger
DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON bids;
CREATE TRIGGER trigger_notify_on_counter_offer AFTER UPDATE ON bids FOR EACH ROW EXECUTE FUNCTION notify_on_counter_offer();

DO $$
BEGIN
    RAISE NOTICE '✅ Multi-Bidder RLS and Notification Logic Fully Synchronized';
END $$;
