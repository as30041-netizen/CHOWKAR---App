-- ⚠️⚠️⚠️ CRITICAL: DELETE ALL USERS AND ALL DATA ⚠️⚠️⚠️
-- This script will PERMANENTLY DELETE EVERYTHING
-- Fixed to handle foreign key constraints properly

-- =============================================================================
-- STEP 1: Delete from tables with foreign keys (in correct order)
-- =============================================================================

DO $$ 
DECLARE
  deleted_count integer;
BEGIN
  RAISE NOTICE '🔥 Starting complete database wipe...';
  RAISE NOTICE '';

  -- Delete payments FIRST (has foreign key to profiles/users)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    DELETE FROM public.payments;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ Deleted % payments', deleted_count;
  END IF;

  -- Delete reviews
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews') THEN
    DELETE FROM public.reviews;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ Deleted % reviews', deleted_count;
  END IF;

  -- Delete notifications
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    DELETE FROM public.notifications;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ Deleted % notifications', deleted_count;
  END IF;

  -- Delete transactions
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    DELETE FROM public.transactions;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ Deleted % transactions', deleted_count;
  END IF;

  -- Delete chats
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chats') THEN
    DELETE FROM public.chats;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ Deleted % chats', deleted_count;
  END IF;

  -- Delete bids
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bids') THEN
    DELETE FROM public.bids;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ Deleted % bids', deleted_count;
  END IF;

  -- Delete jobs
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs') THEN
    DELETE FROM public.jobs;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ Deleted % jobs', deleted_count;
  END IF;

  -- Delete from public.users (if exists)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    DELETE FROM public.users;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ Deleted % records from public.users', deleted_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ All public data deleted!';
END $$;

-- =============================================================================
-- STEP 2: Delete ALL users from Supabase Auth
-- =============================================================================

DO $$
DECLARE
  user_record record;
  deleted_count integer := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔥 Deleting ALL user accounts from Supabase Auth...';
  
  -- Delete users one by one using auth.admin_delete_user()
  -- This properly handles all CASCADE operations
  FOR user_record IN SELECT id FROM auth.users LOOP
    BEGIN
      -- Use Supabase's admin function to properly delete user and all related data
      PERFORM auth.admin_delete_user(user_record.id::text);
      deleted_count := deleted_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '✓ Deleted % user accounts from auth.users', deleted_count;
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ ALL USERS DELETED - No one can log in now!';
END $$;

-- =============================================================================
-- STEP 3: Verification - Show final counts
-- =============================================================================

DO $$
DECLARE
  auth_users_count integer := 0;
  public_users_count integer := 0;
  jobs_count integer := 0;
  bids_count integer := 0;
  chats_count integer := 0;
  notifications_count integer := 0;
  transactions_count integer := 0;
  payments_count integer := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== 📊 FINAL VERIFICATION ===';
  
  -- Count auth.users
  SELECT COUNT(*) INTO auth_users_count FROM auth.users;
  RAISE NOTICE 'Auth Users (auth.users): %', auth_users_count;
  
  -- Count public.users (if exists)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    SELECT COUNT(*) INTO public_users_count FROM public.users;
    RAISE NOTICE 'Public Users (public.users): %', public_users_count;
  END IF;
  
  -- Count jobs
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs') THEN
    SELECT COUNT(*) INTO jobs_count FROM public.jobs;
    RAISE NOTICE 'Jobs: %', jobs_count;
  END IF;
  
  -- Count bids
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bids') THEN
    SELECT COUNT(*) INTO bids_count FROM public.bids;
    RAISE NOTICE 'Bids: %', bids_count;
  END IF;
  
  -- Count chats
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chats') THEN
    SELECT COUNT(*) INTO chats_count FROM public.chats;
    RAISE NOTICE 'Chats: %', chats_count;
  END IF;
  
  -- Count notifications
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    SELECT COUNT(*) INTO notifications_count FROM public.notifications;
    RAISE NOTICE 'Notifications: %', notifications_count;
  END IF;
  
  -- Count transactions
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    SELECT COUNT(*) INTO transactions_count FROM public.transactions;
    RAISE NOTICE 'Transactions: %', transactions_count;
  END IF;
  
  -- Count payments
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    SELECT COUNT(*) INTO payments_count FROM public.payments;
    RAISE NOTICE 'Payments: %', payments_count;
  END IF;

  RAISE NOTICE '';
  IF auth_users_count = 0 AND jobs_count = 0 AND bids_count = 0 AND payments_count = 0 THEN
    RAISE NOTICE '✅✅✅ COMPLETE WIPE SUCCESSFUL! ✅✅✅';
    RAISE NOTICE 'Database is now completely empty of user data.';
  ELSE
    RAISE WARNING '⚠️ Some data may still remain!';
  END IF;
END $$;

-- =============================================================================
-- DONE! 
-- Next steps:
-- 1. In browser console: localStorage.clear(); sessionStorage.clear(); location.reload()
-- 2. Sign up with a new account
-- =============================================================================
