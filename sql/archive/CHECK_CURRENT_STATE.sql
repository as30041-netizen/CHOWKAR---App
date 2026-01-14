-- Check what triggers actually exist RIGHT NOW
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name,
  t.tgenabled as enabled,
  CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END as timing,
  CASE 
    WHEN t.tgtype & 64 = 64 THEN 'INSERT'
    WHEN t.tgtype & 32 = 32 THEN 'DELETE'
    WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
  END as event
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'bids'::regclass
  AND (tgname LIKE '%counter%' OR p.proname LIKE '%counter%')
ORDER BY t.tgname;

-- Check recent notifications to see the pattern
SELECT 
  n.id,
  n.user_id,
  p.name as recipient_name,
  n.title,
  n.message,
  n.created_at
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.title LIKE '%Counter%'
  AND n.created_at > NOW() - INTERVAL '15 minutes'
ORDER BY n.created_at DESC;
