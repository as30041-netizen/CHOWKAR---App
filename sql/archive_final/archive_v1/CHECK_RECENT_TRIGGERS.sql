
-- Corrected trigger check using information_schema
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_timing 
FROM information_schema.triggers 
WHERE trigger_name IN (
    'notify_counter_offer',
    'notify_job_completion',
    'notify_job_cancellation',
    'trg_notify_cancellation',
    'trg_sync_user_phone',
    'trg_sync_user_name',
    'on_auth_user_created'
);
