-- ============================================================================
-- DIAGNOSE_ALL_TRIGGERS.sql
-- ============================================================================
-- Run this to find out WHY you are getting duplicate messages.
-- 1. Lists ALL triggers on 'chat_messages' (Source of loop?)
-- 2. Lists ALL triggers on 'notifications' (Source of Push?)
-- 3. Shows the last 5 Notifications (Are they duplicates in DB?)
-- 4. Shows the last 10 Debug Logs (Is the script creating them?)
-- ============================================================================

-- A. LIST CHAT TRIGGERS
SELECT 
    trigger_name, 
    action_timing, 
    event_manipulation 
FROM information_schema.triggers 
WHERE event_object_table = 'chat_messages' 
AND trigger_schema = 'public';

-- B. LIST NOTIFICATION TRIGGERS
SELECT 
    trigger_name, 
    action_timing, 
    event_manipulation 
FROM information_schema.triggers 
WHERE event_object_table = 'notifications' 
AND trigger_schema = 'public';

-- C. CHECK RECENT NOTIFICATIONS (Are there DB duplicates?)
SELECT id, title, message, created_at 
FROM notifications 
ORDER BY created_at DESC 
LIMIT 5;

-- D. CHECK LOGS (Is the loop firing rapidly?)
SELECT event, details, created_at 
FROM push_debug_logs 
ORDER BY created_at DESC 
LIMIT 10;
