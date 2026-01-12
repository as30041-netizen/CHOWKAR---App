-- CHECK: RLS policies on chat_messages table
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'chat_messages'
ORDER BY policyname;

-- Also check if realtime is enabled for chat_messages
SELECT 
  publication_name
FROM pg_publication_tables
WHERE tablename = 'chat_messages';
