/*
  ============================================================
  AUTH DEBUGGER & PANIC CHECK
  ============================================================
  Run this script to see if the trigger hit any silent errors.
  ============================================================
*/

-- 1. Check for caught errors
SELECT '🛑 PANIC LOGS' as info;
SELECT * FROM public.auth_panic_logs ORDER BY created_at DESC LIMIT 10;

-- 2. Check Profiles table structure
SELECT '📋 PROFILES SCHEMA' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check Triggers on auth.users
SELECT '⚡ ACTIVE TRIGGERS' as info;
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users' AND event_object_schema = 'auth';
