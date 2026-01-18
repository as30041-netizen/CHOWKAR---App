
-- Check if the auto-profile trigger exists
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_timing 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created'
OR event_object_table = 'profiles';
