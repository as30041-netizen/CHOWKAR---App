-- ============================================
-- ENABLE REALTIME FOR BIDS AND NOTIFICATIONS
-- ============================================
-- This script enables Supabase realtime for critical tables
-- and adds notification triggers for new bids
-- 
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: ENABLE REALTIME PUBLICATION
-- ============================================

-- Enable realtime for bids table (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bids;
    RAISE NOTICE 'Added bids table to realtime publication';
  ELSE
    RAISE NOTICE 'Bids table already in realtime publication';
  END IF;
END $$;

-- Enable realtime for notifications (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    RAISE NOTICE 'Added notifications table to realtime publication';
  ELSE
    RAISE NOTICE 'Notifications table already in realtime publication';
  END IF;
END $$;

-- Enable realtime for jobs (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
    RAISE NOTICE 'Added jobs table to realtime publication';
  ELSE
    RAISE NOTICE 'Jobs table already in realtime publication';
  END IF;
END $$;

-- ============================================
-- PART 2: BID NOTIFICATION TRIGGER
-- ============================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
DROP FUNCTION IF EXISTS notify_poster_of_new_bid();

-- Create function to notify poster of new bids
CREATE OR REPLACE FUNCTION notify_poster_of_new_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_worker_name TEXT;
BEGIN
  -- Get job details
  SELECT * INTO v_job
  FROM jobs
  WHERE id = NEW.job_id;
  
  IF NOT FOUND THEN
    RAISE WARNING 'Job not found for bid: %', NEW.id;
    RETURN NEW;
  END IF;
  
  -- Get worker name from profiles
  SELECT name INTO v_worker_name
  FROM profiles
  WHERE id = NEW.worker_id;
  
  -- Create notification for job poster
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    related_job_id,
    read,
    created_at
  ) VALUES (
    v_job.poster_id,
    'bid_received',
    'New Bid',
    'New bid of ₹' || NEW.amount || ' from ' || COALESCE(v_worker_name, 'A worker') || ' on "' || v_job.title || '"',
    NEW.job_id,
    false,
    NOW()
  );
  
  RAISE NOTICE 'Notification created for poster % on job %', v_job.poster_id, NEW.job_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to fire on new bids
CREATE TRIGGER on_bid_created_notify
AFTER INSERT ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_poster_of_new_bid();

-- ============================================
-- PART 3: VERIFICATION QUERIES
-- ============================================

-- Check realtime is enabled
SELECT 
  schemaname,
  tablename,
  'Realtime Enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('bids', 'notifications', 'jobs')
ORDER BY tablename;

-- Check trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name,
  'Active' as status
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname = 'on_bid_created_notify';

-- Show existing bids for testing
SELECT 
  b.id,
  b.job_id,
  b.worker_id,
  b.amount,
  b.status,
  b.created_at,
  j.title as job_title,
  j.poster_id
FROM bids b
JOIN jobs j ON b.job_id = j.id
ORDER BY b.created_at DESC
LIMIT 5;

-- ============================================
-- TESTING
-- ============================================

/*
To test the notification trigger, insert a test bid:

INSERT INTO bids (job_id, worker_id, amount, message, status)
SELECT 
  id as job_id,
  (SELECT id FROM profiles WHERE id != poster_id LIMIT 1) as worker_id,
  500 as amount,
  'Test bid for notification trigger' as message,
  'PENDING' as status
FROM jobs
WHERE status = 'OPEN'
LIMIT 1;

Then check notifications were created:

SELECT * FROM notifications 
WHERE title = 'New Bid'
ORDER BY created_at DESC 
LIMIT 5;
*/

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Realtime enabled for bids, notifications, and jobs tables';
  RAISE NOTICE '✅ Bid notification trigger created';
  RAISE NOTICE '✅ Run the verification queries above to confirm';
  RAISE NOTICE 'ℹ️  Next: Update frontend code to add realtime subscriptions';
END $$;
