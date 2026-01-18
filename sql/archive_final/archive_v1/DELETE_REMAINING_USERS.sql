-- Delete remaining users from auth.users
-- This uses a direct DELETE approach with CASCADE

-- IMPORTANT: Run this ONLY after the previous script
-- This cleans up the remaining 14 users

DO $$
DECLARE
  deleted_count integer;
BEGIN
  RAISE NOTICE 'Deleting remaining users from auth.users...';
  
  -- First, delete from auth.identities (linked to users)
  DELETE FROM auth.identities;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✓ Deleted % identities', deleted_count;
  
  -- Delete from auth.sessions
  DELETE FROM auth.sessions;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✓ Deleted % sessions', deleted_count;
  
  -- Delete from auth.refresh_tokens
  DELETE FROM auth.refresh_tokens;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✓ Deleted % refresh tokens', deleted_count;
  
  -- Finally delete from auth.users
  DELETE FROM auth.users;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✓ Deleted % users from auth.users', deleted_count;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ ALL USERS DELETED!';
END $$;

-- Verify
SELECT 
  (SELECT COUNT(*) FROM auth.users) as remaining_users,
  (SELECT COUNT(*) FROM auth.identities) as remaining_identities,
  (SELECT COUNT(*) FROM auth.sessions) as remaining_sessions;
