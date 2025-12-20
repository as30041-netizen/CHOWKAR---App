-- Check for triggers that might be creating chats
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (event_object_table = 'jobs' OR event_object_table = 'bids' OR event_object_table = 'chats')
ORDER BY event_object_table;

-- List all triggers on jobs table
SELECT tgname, tgrelid::regclass, tgtype, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.jobs'::regclass;

-- List all functions that might create chats
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_definition ILIKE '%INSERT INTO chats%';
