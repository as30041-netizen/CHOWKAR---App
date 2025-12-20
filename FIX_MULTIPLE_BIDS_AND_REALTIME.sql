-- ============================================
-- FIX MULTIPLE BIDS & REAL-TIME ISSUES
-- ============================================
-- This script fixes:
-- 1. Workers cannot place bids when others already have
-- 2. Real-time bid updates not working
-- 3. Real-time notifications not working
-- ============================================

-- ============================================
-- FIX 1: ALLOW WORKERS TO SEE ALL BIDS ON OPEN JOBS
-- ============================================
-- Currently workers can only see their own bids
-- This prevents them from knowing if a job already has  bids
-- We need to allow workers to see ALL bids on OPEN jobs

DROP POLICY IF EXISTS "Workers can view own bids" ON bids;

-- New policy: Workers can view bids on open jobs AND own bids on ANY job
CREATE POLICY "Workers can view bids on open jobs and own bids"
  ON bids FOR SELECT
  TO authenticated
  USING (
    worker_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = bids.job_id
      AND jobs.status = 'OPEN'
    )
  );

-- ============================================
-- FIX 2: ENABLE REALTIME FOR ALL CRITICAL TABLES
-- ============================================

-- Check if tables are in realtime publication
DO $$
BEGIN
  -- Enable realtime for bids
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bids;
    RAISE NOTICE 'Added bids to realtime';
  ELSE
    RAISE NOTICE 'Bids already in realtime';
  END IF;

  -- Enable realtime for notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    RAISE NOTICE 'Added notifications to realtime';
  ELSE
    RAISE NOTICE 'Notifications already in realtime';
  END IF;

  -- Enable realtime for jobs
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
    RAISE NOTICE 'Added jobs to realtime';
  ELSE
    RAISE NOTICE 'Jobs already in realtime';
  END IF;
END $$;

-- ============================================
-- FIX 3: CREATE NOTIFICATION TRIGGER FOR NEW BIDS
-- ============================================

-- Drop existing if any
DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
DROP FUNCTION IF EXISTS notify_poster_of_new_bid();

-- Create function to notify poster when new bid is placed
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
  
  -- Get worker name
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

-- Create trigger
CREATE TRIGGER on_bid_created_notify
AFTER INSERT ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_poster_of_new_bid();

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- 1. Check RLS policy is updated
SELECT 
  policyname as policy_name,
  'bids' as table_name,
  'SELECT' as operation,
  'ACTIVE' as status
FROM pg_policies
WHERE tablename = 'bids'
AND policyname = 'Workers can view bids on open jobs and own bids';

-- 2. Check realtime is enabled
SELECT 
  schemaname,
  tablename,
  'Realtime Enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('bids', 'notifications', 'jobs')
ORDER BY tablename;

-- 3. Check trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name,
  'ACTIVE' as status
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname = 'on_bid_created_notify';

-- 4. Test with sample data
-- List recent bids to verify
SELECT 
  b.id,
  b.job_id,
  j.title as job_title,
  j.status as job_status,
  b.worker_id,
  b.amount,
  b.created_at
FROM bids b
JOIN jobs j ON b.job_id = j.id
ORDER BY b.created_at DESC
LIMIT 5;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '✅ FIXES APPLIED SUCCESSFULLY';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
  RAISE NOTICE '1. ✅ Workers can now see all bids on OPEN jobs';
  RAISE NOTICE '2. ✅ Real-time enabled for bids, notifications, jobs';
  RAISE NOTICE '3. ✅ Automatic notifications created for new bids';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Rebuild app: npx cap sync android';
  RAISE NOTICE '2. Test: Multiple workers can bid on same job';
  RAISE NOTICE '3. Test: Bids appear in real-time';
  RAISE NOTICE '4. Test: Notifications appear instantly';
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
END $$;
