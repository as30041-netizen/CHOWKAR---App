-- VERIFY & FIX RPC FUNCTIONS
-- Run this to check if functions exist and have correct signatures

-- 1. Check if functions exist
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('get_home_feed', 'get_my_jobs_feed', 'get_my_applications_feed', 'action_place_bid')
ORDER BY p.proname;
