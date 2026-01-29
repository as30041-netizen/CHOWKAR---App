/*
  ============================================================
  CHOWKAR MASTER AUTH AUDIT
  ============================================================
  This script will reveal EVERYTHING happening in the 
  background during auth.
  ============================================================
*/

-- 1. List ALL triggers on auth.users (No matter the name)
SELECT '⚡ AUTH.USERS TRIGGERS' as info;
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement, 
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users' 
AND event_object_schema = 'auth';

-- 2. List ALL triggers on profiles
SELECT '⚡ PROFILES TRIGGERS' as info;
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement, 
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'profiles' 
AND event_object_schema = 'public';

-- 3. Check for any "Zombie" triggers that might be named differently
SELECT '🧟 POSSIBLE ORPHAN FUNCTIONS' as info;
SELECT proname, prosrc 
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' 
AND (proname ILIKE '%user%' OR proname ILIKE '%auth%' OR proname ILIKE '%profile%');

-- 4. Check for Foreign Key constraints on profiles
SELECT '🔒 PROFILES CONSTRAINTS' as info;
SELECT 
    conname AS constraint_name, 
    pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE t.relname = 'profiles' AND n.nspname = 'public';

-- 5. Check Panic Logs one last time
SELECT '🏁 PANIC LOGS' as info;
SELECT * FROM public.auth_panic_logs ORDER BY created_at DESC LIMIT 5;
