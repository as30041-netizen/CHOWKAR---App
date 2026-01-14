-- ============================================
-- FIX JOB COMPLETION NOTIFICATION
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Drop existing trigger if exists (to avoid duplicates)
DROP TRIGGER IF EXISTS trigger_notify_on_job_completion ON jobs;
DROP TRIGGER IF EXISTS on_job_complete_notify ON jobs;

-- 2. Create the notification function
CREATE OR REPLACE FUNCTION notify_on_job_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID;
  v_bid_amount INTEGER;
  v_worker_name TEXT;
BEGIN
  -- Only proceed if job was just completed
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
    
    -- Get accepted bid details
    SELECT worker_id, amount INTO v_worker_id, v_bid_amount
    FROM bids
    WHERE id = NEW.accepted_bid_id;
    
    IF v_worker_id IS NOT NULL THEN
      -- Get worker name
      SELECT name INTO v_worker_name FROM profiles WHERE id = v_worker_id;
      
      -- Notify worker that job is complete with job context
      INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
      VALUES (
        v_worker_id,
        'SUCCESS',
        'Job Completed! 💰',
        'Great work on "' || NEW.title || '"! ₹' || v_bid_amount || ' has been credited to your wallet.',
        NEW.id,
        false,
        NOW()
      );
      
      RAISE NOTICE '✅ Completion notification sent to worker %', v_worker_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Create the trigger
CREATE TRIGGER trigger_notify_on_job_completion
AFTER UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION notify_on_job_completion();

-- 4. Verification: Check trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  '✅ Active' as status
FROM pg_trigger
WHERE tgname = 'trigger_notify_on_job_completion';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ JOB COMPLETION NOTIFICATION TRIGGER DEPLOYED';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'When a poster marks a job as COMPLETED:';
  RAISE NOTICE '• Worker receives in-app notification';
  RAISE NOTICE '• Push notification will be sent (if enabled)';
  RAISE NOTICE '';
END $$;
