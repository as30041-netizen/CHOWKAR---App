-- COMPREHENSIVE CHAT MESSAGE DIAGNOSIS (FIXED)

-- 1. Check if messages were actually saved to database for this job
SELECT 
  id,
  job_id,
  sender_id,
  receiver_id,
  LEFT(text, 30) as text_preview,
  created_at
FROM chat_messages
WHERE job_id = '0487f8d9-d09a-40ec-8338-4f98122aa42a'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check RLS policies on chat_messages (to see if Worker is blocked from reading)
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'chat_messages';

-- 3. Check for the notification trigger and function
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'chat_messages';

-- 4. Check if publication exists for realtime (FIXED COLUMN NAME)
SELECT pubname, schemaname, tablename 
FROM pg_publication_tables 
WHERE tablename = 'chat_messages';
