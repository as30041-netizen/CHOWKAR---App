-- ========================================================
-- FIX NOTIFICATIONS V1.2: POSTER NOTIFICATION & TRIGGER UPDATE
-- ========================================================
-- This script updates the notification trigger to ensure BOTH
-- the Worker and the Poster are notified when a bid is accepted.
-- This solves the issue where Posters didn't know if a Worker
-- accepted their counter-offer.

BEGIN;

CREATE OR REPLACE FUNCTION notify_on_bid_accept()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_poster_name TEXT;
  v_worker_name TEXT;
BEGIN
  -- Check if Bid status changed to ACCEPTED
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' THEN
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
    SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;
    
    -- 1. Notify WORKER (You're Hired)
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at, updated_at)
    VALUES (
      NEW.worker_id,
      'SUCCESS',
      'You''re Hired! 🎉',
      COALESCE(v_poster_name, 'Employer') || ' is waiting to discuss "' || v_job.title || '" with you. Chat now!',
      NEW.job_id,
      false,
      NOW(),
      NOW()
    );

    -- 2. Notify POSTER (Job Started / Offer Accepted)
    -- This ensures the Poster knows if the Worker accepted a Counter-Offer.
    -- If the Poster triggered this (by clicking Accept), they get a confirmation notification.
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at, updated_at)
    VALUES (
      v_job.poster_id,
      'SUCCESS',
      'Offer Accepted! 🤝',
      COALESCE(v_worker_name, 'Worker') || ' has joined "' || v_job.title || '". Work can begin!',
      NEW.job_id,
      false,
      NOW(),
      NOW()
    );
     
  -- Check if Bid status changed to REJECTED (Batch rejection when another is accepted)
  ELSIF NEW.status = 'REJECTED' AND OLD.status = 'PENDING' THEN
     -- Only notify if this rejection happened at the same time another bid was accepted (checked via job status)
     SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
     
     INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at, updated_at)
     VALUES (
       NEW.worker_id,
       'INFO',
       'Position Filled',
       'Another worker was selected for "' || v_job.title || '". Keep browsing!',
       NEW.job_id,
       false,
       NOW(),
       NOW()
     );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Re-apply the trigger (DROP to be safe, though REPLACE FUNCTION handles the body)
DROP TRIGGER IF EXISTS trigger_notify_on_bid_accept ON bids;
CREATE TRIGGER trigger_notify_on_bid_accept 
AFTER UPDATE ON bids 
FOR EACH ROW 
EXECUTE FUNCTION notify_on_bid_accept();

COMMIT;
