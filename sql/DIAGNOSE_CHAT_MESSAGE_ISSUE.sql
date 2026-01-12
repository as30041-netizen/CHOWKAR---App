-- COMPREHENSIVE CHAT MESSAGE DIAGNOSIS

-- 1. Check if message was saved to database
SELECT 
  id,
  job_id,
  sender_id,
  receiver_id,
  LEFT(text, 50) as text_preview,
  created_at
FROM chat_messages
WHERE job_id = '0487f8d9-d09a-40ec-8338-4f98122aa42a'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check RLS policies on chat_messages
SELECT 
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'chat_messages';

-- 3. Check triggers on chat_messages table
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'chat_messages';

-- 4. Check if realtime is enabled
SELECT 
  publication_name
FROM pg_publication_tables
WHERE tablename = 'chat_messages';
