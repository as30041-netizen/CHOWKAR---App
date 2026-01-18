-- ========================================================
-- ADD COUNTER NOTIFICATION TRIGGER
-- ========================================================
-- This script ensures workers and posters are notified when a 
-- negotiation counter-offer is made on a bid.

BEGIN;

-- 1. Create the notification function
CREATE OR REPLACE FUNCTION notify_on_bid_negotiation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job_title TEXT;
  v_poster_id UUID;
  v_last_negotiator_role TEXT;
  v_amount INTEGER;
BEGIN
  -- We only care about updates where negotiation_history has changed
  IF NEW.negotiation_history IS DISTINCT FROM OLD.negotiation_history 
     AND NEW.negotiation_history IS NOT NULL 
     AND jsonb_array_length(NEW.negotiation_history) > 0 THEN
    
    -- Get the last entry in the history to know who made the offer
    v_last_negotiator_role := NEW.negotiation_history->-1->>'by';
    v_amount := (NEW.negotiation_history->-1->>'amount')::INTEGER;

    -- Get job details
    SELECT title, poster_id INTO v_job_title, v_poster_id FROM jobs WHERE id = NEW.job_id;

    -- If the POSTER countered, notify the WORKER
    IF v_last_negotiator_role = 'POSTER' THEN
      INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at, updated_at)
      VALUES (
        NEW.worker_id,
        'WARNING',
        'New Counter Offer 💰',
        'The poster proposed ₹' || v_amount || ' for "' || v_job_title || '". Tap to review!',
        NEW.job_id,
        false,
        NOW(),
        NOW()
      );
    
    -- If the WORKER countered, notify the POSTER
    ELSIF v_last_negotiator_role = 'WORKER' THEN
      INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at, updated_at)
      VALUES (
        v_poster_id,
        'INFO',
        'Bid Negotiated: ₹' || v_amount || ' 🤝',
        'A worker has countered your offer for "' || v_job_title || '". Tap to respond!',
        NEW.job_id,
        false,
        NOW(),
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Attach the trigger
DROP TRIGGER IF EXISTS trigger_notify_on_bid_negotiation ON bids;
CREATE TRIGGER trigger_notify_on_bid_negotiation
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_bid_negotiation();

COMMIT;
