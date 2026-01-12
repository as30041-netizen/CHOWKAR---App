-- ============================================
-- TEMPORARY: DISABLE RLS ON PROFILES
-- ============================================
-- WARNING: This removes all access control!
-- Only use this to test, then re-enable with proper policies
-- ============================================

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    RAISE NOTICE '⚠️  RLS DISABLED on profiles table';
    RAISE NOTICE '   This is TEMPORARY for testing only!';
    RAISE NOTICE '   Re-enable after confirming it fixes the 401';
END $$;
