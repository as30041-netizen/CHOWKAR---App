-- ⚠️ DANGER: DELETE ALL USER DATA ⚠️
-- This script will permanently delete ALL user-generated content from the database
-- This action is IRREVERSIBLE

-- Disable RLS and Delete Data (only for tables that exist)
DO $$ 
DECLARE
  table_exists boolean;
BEGIN
  -- Check and delete from reviews
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'reviews'
  ) INTO table_exists;
  
  IF table_exists THEN
    ALTER TABLE public.reviews DISABLE ROW LEVEL SECURITY;
    DELETE FROM public.reviews;
    ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Deleted all reviews';
  END IF;

  -- Check and delete from notifications
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) INTO table_exists;
  
  IF table_exists THEN
    ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
    DELETE FROM public.notifications;
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Deleted all notifications';
  END IF;

  -- Check and delete from transactions
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'transactions'
  ) INTO table_exists;
  
  IF table_exists THEN
    ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
    DELETE FROM public.transactions;
    ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Deleted all transactions';
  END IF;

  -- Check and delete from chats
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'chats'
  ) INTO table_exists;
  
  IF table_exists THEN
    ALTER TABLE public.chats DISABLE ROW LEVEL SECURITY;
    DELETE FROM public.chats;
    ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Deleted all chats';
  END IF;

  -- Check and delete from bids
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'bids'
  ) INTO table_exists;
  
  IF table_exists THEN
    ALTER TABLE public.bids DISABLE ROW LEVEL SECURITY;
    DELETE FROM public.bids;
    ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Deleted all bids';
  END IF;

  -- Check and delete from jobs
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'jobs'
  ) INTO table_exists;
  
  IF table_exists THEN
    ALTER TABLE public.jobs DISABLE ROW LEVEL SECURITY;
    DELETE FROM public.jobs;
    ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Deleted all jobs';
  END IF;

  -- Check and delete from users (auth.users in Supabase)
  -- Note: In Supabase, user data is in auth.users, not public.users
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
  ) INTO table_exists;
  
  IF table_exists THEN
    ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
    DELETE FROM public.users;
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Deleted all users from public.users';
  END IF;

  RAISE NOTICE '✅ ALL USER DATA DELETED SUCCESSFULLY!';
END $$;

-- Show final counts for verification
DO $$
DECLARE
  jobs_count integer := 0;
  bids_count integer := 0;
  chats_count integer := 0;
  notifications_count integer := 0;
BEGIN
  -- Only count if tables exist
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs') THEN
    SELECT COUNT(*) INTO jobs_count FROM public.jobs;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bids') THEN
    SELECT COUNT(*) INTO bids_count FROM public.bids;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chats') THEN
    SELECT COUNT(*) INTO chats_count FROM public.chats;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    SELECT COUNT(*) INTO notifications_count FROM public.notifications;
  END IF;

  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'Remaining jobs: %', jobs_count;
  RAISE NOTICE 'Remaining bids: %', bids_count;
  RAISE NOTICE 'Remaining chats: %', chats_count;
  RAISE NOTICE 'Remaining notifications: %', notifications_count;
END $$;
