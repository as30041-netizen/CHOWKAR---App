-- ============================================
-- FIX BIDDING & REALTIME ISSUES - COMPLETE FIX
-- ============================================
-- Issues identified:
-- 1. ❌ Workers cannot bid (INSERT fails due to poster_id column not existing)
-- 2. ❌ Real-time not enabled
-- 3. ❌ No notification trigger for new bids
-- 
-- Business Model (CORRECT):
-- ✅ Workers should NOT see other workers' bids (blind bidding)
-- ✅ Workers CAN submit multiple bids on same job
-- ✅ Posters CAN see ALL bids on their jobs
-- ============================================

-- ============================================
-- FIX 1: ENABLE REALTIME
-- ============================================

DO $$
BEGIN
  -- Bids table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bids;
    RAISE NOTICE '✅ Added bids to realtime';
  ELSE
    RAISE NOTICE 'ℹ️  Bids already in realtime';
  END IF;

  -- Notifications table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    RAISE NOTICE '✅ Added notifications to realtime';
  ELSE
    RAISE NOTICE 'ℹ️  Notifications already in realtime';
  END IF;

  -- Jobs table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
    RAISE NOTICE '✅ Added jobs to realtime';
  ELSE
    RAISE NOTICE 'ℹ️  Jobs already in realtime';
  END IF;
END $$;

-- ============================================
-- FIX 2: CREATE NOTIFICATION TRIGGER
-- ============================================

DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
DROP FUNCTION IF EXISTS notify_poster_of_new_bid();

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
    'INFO',
    'New Bid',
    'New bid of ₹' || NEW.amount || ' from ' || COALESCE(v_worker_name, 'A worker') || ' on "' || v_job.title || '"',
    NEW.job_id,
    false,
    NOW()
  );
  
  RAISE NOTICE '✅ Notification created for poster % on job %', v_job.poster_id, NEW.job_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_bid_created_notify
AFTER INSERT ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_poster_of_new_bid();

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- 1. Check realtime enabled
SELECT 
  tablename,
  '✅ Realtime Enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('bids', 'notifications', 'jobs')
ORDER BY tablename;

-- 2. Check trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  '✅ Active' as status
FROM pg_trigger
WHERE tgname = 'on_bid_created_notify';

-- 3. Check RLS policies for bids
SELECT 
  policyname,
  cmd as operation,
  '✅ Active' as status
FROM pg_policies
WHERE tablename = 'bids'
ORDER BY cmd, policyname;

-- 4. Test - show recent jobs to verify
SELECT 
  id,
  title,
  status,
  poster_id,
  created_at
FROM jobs
ORDER BY created_at DESC
LIMIT 3;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ DATABASE FIXES APPLIED SUCCESSFULLY';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Real-time enabled for: bids, notifications, jobs';
  RAISE NOTICE '✅ Notification trigger created for new bids';
  RAISE NOTICE '✅ RLS policies UNCHANGED (correct for blind bidding)';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT: Fix frontend code:';
  RAISE NOTICE '1. Remove poster_id from bid INSERT';
  RAISE NOTICE '2. Rebuild app';
  RAISE NOTICE '3. Test bidding';
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
END $$;
