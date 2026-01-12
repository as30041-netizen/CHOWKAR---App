-- FINAL REALTIME & NOTIFICATION FIX V3
-- Fixes triggers to notify the WRONG person (worker notifying themselves)
-- Ensures Poster is notified when Worker counters and vice versa

BEGIN;

-- ============================================================================
-- 1. REFINED NOTIFICATION TRIGGERS
-- ============================================================================

-- A. Notify Poster when a Worker Bids (Already correct, but reinforcing)
CREATE OR REPLACE FUNCTION notify_poster_on_new_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_title TEXT;
  v_poster_id UUID;
  v_worker_name TEXT;
BEGIN
  SELECT title, poster_id INTO v_job_title, v_poster_id FROM jobs WHERE id = NEW.job_id;
  v_worker_name := COALESCE(NEW.worker_name, 'A worker');
  
  INSERT INTO notifications (user_id, type, title, message, related_job_id)
  VALUES (v_poster_id, 'INFO', 'New Bid Received! 💰', v_worker_name || ' bid ₹' || NEW.amount || ' on "' || v_job_title || '"', NEW.job_id);
  
  RETURN NEW;
END;
$$;

-- B. Notify the OTHER party on Counter Offer
CREATE OR REPLACE FUNCTION notify_on_counter_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_title TEXT;
  v_poster_id UUID;
  v_last_negotiator TEXT;
  v_amount_changed BOOLEAN;
BEGIN
  -- 1. Check if it's a counter (amount or history length changed)
  v_amount_changed := (NEW.amount != OLD.amount) OR 
                      (jsonb_array_length(NEW.negotiation_history) != jsonb_array_length(OLD.negotiation_history));
  
  IF v_amount_changed AND NEW.status = 'PENDING' THEN
    -- 2. Get Job Info
    SELECT title, poster_id INTO v_job_title, v_poster_id FROM jobs WHERE id = NEW.job_id;
    
    -- 3. Determine who sent the last message from negotiation_history
    -- Expecting format: [{"by": "POSTER", ...}, {"by": "WORKER", ...}]
    v_last_negotiator := (NEW.negotiation_history->-1->>'by');
    
    IF v_last_negotiator = 'WORKER' THEN
      -- Worker countered -> Notify Poster
      INSERT INTO notifications (user_id, type, title, message, related_job_id)
      VALUES (v_poster_id, 'INFO', 'Counter Received! 💬', 'Worker countered ₹' || NEW.amount || ' for "' || v_job_title || '"', NEW.job_id);
    ELSIF v_last_negotiator = 'POSTER' THEN
      -- Poster countered -> Notify Worker
      INSERT INTO notifications (user_id, type, title, message, related_job_id)
      VALUES (NEW.worker_id, 'INFO', 'New Offer! 💬', 'Employer offered ₹' || NEW.amount || ' for "' || v_job_title || '"', NEW.job_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_bid_counter_notify ON bids;
CREATE TRIGGER on_bid_counter_notify
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_counter_offer();

-- C. Notify Worker when Bid is Accepted
CREATE OR REPLACE FUNCTION notify_worker_on_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_title TEXT;
BEGIN
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' THEN
    SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;
    INSERT INTO notifications (user_id, type, title, message, related_job_id)
    VALUES (NEW.worker_id, 'SUCCESS', 'Bid Accepted! 🎉', 'Your bid for "' || v_job_title || '" was accepted! Tap to start.', NEW.job_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_bid_accepted_notify ON bids;
CREATE TRIGGER on_bid_accepted_notify
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_worker_on_accept();

-- ============================================================================
-- 2. REPLICATION & RLS
-- ============================================================================

-- Ensure replication identity is FULL for surgical updates
ALTER TABLE jobs REPLICA IDENTITY FULL;
ALTER TABLE bids REPLICA IDENTITY FULL;

-- Ensure RLS is permissive enough for notifications to be seen instantly
DROP POLICY IF EXISTS "Anyone can read own notifications" ON notifications;
CREATE POLICY "Anyone can read own notifications" ON notifications FOR SELECT TO anon, authenticated USING (true);

COMMIT;
