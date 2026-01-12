-- QUICK CHECK: Are the feed RPCs working?
-- Run each of these one at a time

-- 1. Check if get_home_feed exists and works
SELECT 
  proname as function_name,
  'EXISTS' as status
FROM pg_proc
WHERE proname IN ('get_home_feed', 'get_my_jobs_feed', 'get_my_applications_feed');

-- 2. Test get_home_feed with a sample user
-- Replace 'YOUR_USER_ID' with an actual user UUID
-- SELECT * FROM get_home_feed('YOUR_USER_ID'::UUID, 20, 0);
