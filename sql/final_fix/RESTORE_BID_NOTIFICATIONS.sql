-- ============================================================================
-- RESTORE BID NOTIFICATIONS
-- Description: Re-creates the notify_on_bid_accept trigger to ensure workers
--              receive notifications when their bid is accepted.
-- ============================================================================

-- 1. Ensure Notification Types are valid (Idempotent)
DO $$
BEGIN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN (
        'JOB_UPDATE', 'BID_RECEIVED', 'BID_ACCEPTED', 'MESSAGE', 'PAYMENT', 
        'SYSTEM', 'ACHIEVEMENT', 'INFO', 'SUCCESS', 'ALERT', 'WARNING', 'NOTICE', 'ERROR'
    ));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Constraint update skipped or failed: %', SQLERRM;
END $$;

-- 2. Create/Replace the Notification Function
CREATE OR REPLACE FUNCTION notify_on_bid_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_worker_name TEXT;
  v_poster_name TEXT;
BEGIN
  -- Only proceed if bid was just accepted (status changed to ACCEPTED)
  IF NEW.status = 'ACCEPTED' AND (OLD.status IS NULL OR OLD.status != 'ACCEPTED') THEN
    
    -- Get job details
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    
    -- Get poster name
    SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
    
    -- Notify ACCEPTED worker
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      NEW.worker_id,
      'SUCCESS',
      'You Got the Job! 🎉',
      COALESCE(v_poster_name, 'Employer') || ' selected you for "' || v_job.title || '" at ₹' || NEW.amount || '. Tap to proceed!',
      NEW.job_id,
      false,
      NOW()
    );
    
    RAISE NOTICE '✅ Acceptance notification sent to worker %', NEW.worker_id;
    
    -- Notify all OTHER bidders that job is filled
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    SELECT 
      worker_id,
      'INFO',
      'Job Update',
      'Another worker was selected for "' || v_job.title || '". Keep bidding on other jobs!',
      NEW.job_id,
      false,
      NOW()
    FROM bids
    WHERE job_id = NEW.job_id 
      AND worker_id != NEW.worker_id
      AND status = 'PENDING';
      
    RAISE NOTICE '✅ Rejection notifications sent to other bidders';
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Re-attach the Trigger
DROP TRIGGER IF EXISTS trigger_notify_on_bid_accept ON bids;
CREATE TRIGGER trigger_notify_on_bid_accept
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_bid_accept();

-- 4. Verification Output
DO $$
BEGIN
    RAISE NOTICE 'SUCCESS: notify_on_bid_accept trigger restored on bids table.';
END $$;
