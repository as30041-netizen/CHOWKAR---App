-- ============================================
-- JOB CANCELLATION NOTIFICATION TRIGGER
-- Notifies all affected parties when a job is cancelled
-- ============================================

-- 1. Create the notification function
CREATE OR REPLACE FUNCTION notify_on_job_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accepted_worker_id UUID;
  v_bid_amount INTEGER;
  v_poster_name TEXT;
BEGIN
  -- Only proceed if job was just cancelled
  IF NEW.status = 'CANCELLED' AND (OLD.status IS NULL OR OLD.status != 'CANCELLED') THEN
    
    -- Get poster name
    SELECT name INTO v_poster_name FROM profiles WHERE id = NEW.poster_id;
    
    -- Check if there was an accepted worker (job was IN_PROGRESS)
    IF NEW.accepted_bid_id IS NOT NULL THEN
      -- Get accepted worker details
      SELECT worker_id, amount INTO v_accepted_worker_id, v_bid_amount
      FROM bids
      WHERE id = NEW.accepted_bid_id;
      
      IF v_accepted_worker_id IS NOT NULL THEN
        -- Notify the accepted worker with special message
        INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
        VALUES (
          v_accepted_worker_id,
          'WARNING',
          '⚠️ Job Cancelled',
          COALESCE(v_poster_name, 'The employer') || ' cancelled "' || NEW.title || '". We''re sorry for any inconvenience.',
          NEW.id,
          false,
          NOW()
        );
        
        RAISE NOTICE '✅ Cancellation notification sent to accepted worker %', v_accepted_worker_id;
      END IF;
    END IF;
    
    -- Notify ALL pending bidders (workers who were waiting)
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    SELECT 
      worker_id,
      'INFO',
      'Job No Longer Available',
      '"' || NEW.title || '" has been cancelled by the employer. Keep applying to other jobs!',
      NEW.id,
      false,
      NOW()
    FROM bids
    WHERE job_id = NEW.id 
      AND status = 'PENDING'
      AND (v_accepted_worker_id IS NULL OR worker_id != v_accepted_worker_id);
    
    RAISE NOTICE '✅ Cancellation notifications sent to pending bidders for job %', NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_notify_on_job_cancellation ON jobs;

-- 3. Create the trigger
CREATE TRIGGER trigger_notify_on_job_cancellation
AFTER UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION notify_on_job_cancellation();

-- 4. Verification
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  '✅ Active' as status
FROM pg_trigger
WHERE tgname = 'trigger_notify_on_job_cancellation';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ JOB CANCELLATION NOTIFICATION TRIGGER DEPLOYED';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'When a poster cancels a job:';
  RAISE NOTICE '  • Accepted worker (if any): "⚠️ Job Cancelled"';
  RAISE NOTICE '  • All pending bidders: "Job No Longer Available"';
  RAISE NOTICE '';
END $$;
