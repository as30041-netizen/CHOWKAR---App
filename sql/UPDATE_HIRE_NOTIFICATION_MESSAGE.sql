-- ============================================
-- UPDATE JOB ACCEPTANCE NOTIFICATION MESSAGE
-- ============================================

-- Update the notify_on_bid_accept function with improved message
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
  v_bid_amount INTEGER;
BEGIN
  -- Only proceed if bid was just accepted (status changed to ACCEPTED)
  IF NEW.status = 'ACCEPTED' AND (OLD.status IS NULL OR OLD.status != 'ACCEPTED') THEN
    
    -- Get job details
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    
    -- Get worker name
    SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;
    
    -- Get poster name
    SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
    
    -- Notify ACCEPTED worker with improved message
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      NEW.worker_id,
      'SUCCESS',
      '🎉 You''re Hired!',
      COALESCE(v_poster_name, 'An employer') || ' selected you for "' || v_job.title || '" at ₹' || NEW.amount || '. Open chat to start working!',
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

-- Verify
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Updated notify_on_bid_accept function';
  RAISE NOTICE '';
  RAISE NOTICE 'New notification message:';
  RAISE NOTICE '  Title: "🎉 You''re Hired!"';
  RAISE NOTICE '  Message: "[Poster] selected you for [Job] at ₹XX. Open chat to start working!"';
  RAISE NOTICE '';
END $$;
