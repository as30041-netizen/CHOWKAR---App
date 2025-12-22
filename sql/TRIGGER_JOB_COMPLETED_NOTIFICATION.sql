-- NOTIFY WORKER WHEN JOB IS COMPLETED
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION notify_worker_on_job_completion()
RETURNS TRIGGER AS $$
DECLARE
  accepted_bid_record RECORD;
BEGIN
  -- Only trigger when status changes to COMPLETED
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    
    -- Find the accepted bid to get the worker ID
    SELECT * INTO accepted_bid_record 
    FROM bids 
    WHERE id = NEW.accepted_bid_id;

    IF FOUND THEN
      -- Insert notification for the worker
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        related_job_id,
        created_at
      ) VALUES (
        accepted_bid_record.worker_id,
        'Job Completed! 🌟',
        'The job "' || NEW.title || '" is marked as complete. Please rate your experience!',
        'SUCCESS',
        NEW.id,
        NOW()
      );
    END IF;

  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_job_completed_notify ON jobs;
CREATE TRIGGER on_job_completed_notify
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_worker_on_job_completion();
