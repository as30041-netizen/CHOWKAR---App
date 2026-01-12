-- ============================================
-- TEMPORARY: DISABLE RLS ON ALL MAIN TABLES
-- ============================================
-- WARNING: This removes all access control!
-- Only use to test, then re-enable with proper policies
-- ============================================

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE bids DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    RAISE NOTICE '⚠️  RLS DISABLED on all main tables for testing';
    RAISE NOTICE '   - profiles';
    RAISE NOTICE '   - jobs';
    RAISE NOTICE '   - bids';
    RAISE NOTICE '   - chat_messages';
    RAISE NOTICE '   - notifications';
    RAISE NOTICE '';
    RAISE NOTICE '   Refresh browser and check if data loads';
    RAISE NOTICE '   Then re-enable RLS with proper policies';
END $$;
