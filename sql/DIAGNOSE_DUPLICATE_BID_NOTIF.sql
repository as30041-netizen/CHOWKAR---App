-- DIAGNOSE DUPLICATE NOTIFICATION ISSUE
-- Find all bid notification sources

-- 1. Check recent notifications for this job
SELECT 
  n.id,
  n.user_id,
  n.type,
  n.title,
  n.message,
  n.created_at
FROM notifications n
WHERE n.title LIKE '%Bid%' OR n.title LIKE '%bid%'
ORDER BY n.created_at DESC
LIMIT 15;

-- 2. Check all triggers on bids table
SELECT 
  tgname as trigger_name,
  proname as function_name,
  tgenabled as enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'bids'::regclass
ORDER BY tgname;

-- 3. Check the specific bid notification function
SELECT 
  proname,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname LIKE '%bid%notify%' OR proname LIKE '%notify%bid%' OR proname LIKE 'on_bid_created%';
