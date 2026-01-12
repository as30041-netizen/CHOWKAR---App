-- CHECK IF CHAT MESSAGE NOTIFICATION TRIGGER EXISTS
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'chat_messages'
ORDER BY trigger_name;

-- Also check the function
SELECT 
  proname,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname LIKE '%message%notify%' OR proname LIKE '%notify%message%';
