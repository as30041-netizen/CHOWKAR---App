-- ============================================
-- TRIGGER: Notify on Job Cancellation
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_job_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poster_name TEXT;
BEGIN
  -- Only trigger when status changes to 'CANCELLED'
  IF NEW.status = 'CANCELLED' AND (OLD.status IS NULL OR OLD.status != 'CANCELLED') THEN
    
    -- Get poster name for the message
    SELECT name INTO v_poster_name FROM profiles WHERE id = NEW.poster_id;
    
    -- Notify ALL workers who have a bid (PENDING or ACCEPTED) on this job
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    SELECT 
      worker_id,
      'WARNING', -- Yellow/Warning type for cancellation
      'Job Cancelled',
      COALESCE(v_poster_name, 'The employer') || ' has cancelled the job "' || NEW.title || '".',
      NEW.id,
      false,
      NOW()
    FROM bids
    WHERE job_id = NEW.id;
    
    RAISE NOTICE '✅ Cancellation notifications sent to % bidders', (SELECT COUNT(*) FROM bids WHERE job_id = NEW.id);
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop and Recreate Trigger
DROP TRIGGER IF EXISTS trigger_notify_on_job_cancelled ON jobs;

CREATE TRIGGER trigger_notify_on_job_cancelled
AFTER UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION notify_on_job_cancelled();
