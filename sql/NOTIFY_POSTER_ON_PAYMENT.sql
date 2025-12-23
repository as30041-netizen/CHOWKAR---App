-- ========================================================
-- NOTIFY POSTER ON WORKER PAYMENT
-- ========================================================
-- Trigger to notify the Poster when the Accepted Worker pays 
-- the connection fee to start the discussion (Chat).

CREATE OR REPLACE FUNCTION notify_poster_on_worker_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_worker_name TEXT;
BEGIN
  -- Check if status changed to PAID
  IF NEW.connection_payment_status = 'PAID' AND (OLD.connection_payment_status IS NULL OR OLD.connection_payment_status != 'PAID') THEN
    
    -- Get Job and Worker info
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;
    
    -- Only notify if it was an accepted bid (security precaution)
    IF v_job.accepted_bid_id = NEW.id THEN
      INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at, updated_at)
      VALUES (
        v_job.poster_id,
        'SUCCESS',
        'Worker Ready! 💬',
        COALESCE(v_worker_name, 'The worker') || ' has joined the chat for "' || v_job.title || '". You can start discussing now!',
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

DROP TRIGGER IF EXISTS trigger_notify_poster_on_worker_payment ON bids;
CREATE TRIGGER trigger_notify_poster_on_worker_payment
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_poster_on_worker_payment();
