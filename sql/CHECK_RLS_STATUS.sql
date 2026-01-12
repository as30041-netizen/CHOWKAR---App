-- Check if RLS is actually disabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('jobs', 'profiles', 'bids', 'chat_messages', 'notifications');
