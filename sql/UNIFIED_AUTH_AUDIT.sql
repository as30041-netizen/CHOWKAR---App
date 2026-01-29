/*
  ============================================================
  UNIFIED AUTH AUDIT
  ============================================================
  This script combines all audit data into one view 
  to eliminate Supabase result pane confusion.
  ============================================================
*/

WITH 
auth_triggers AS (
    SELECT 'AUTH_TRIGGER: ' || trigger_name || ' (' || action_timing || ' ' || event_manipulation || ')' as audit_item
    FROM information_schema.triggers
    WHERE event_object_table = 'users' AND event_object_schema = 'auth'
),
profile_triggers AS (
    SELECT 'PROFILE_TRIGGER: ' || trigger_name || ' (' || action_timing || ' ' || event_manipulation || ')' as audit_item
    FROM information_schema.triggers
    WHERE event_object_table = 'profiles' AND event_object_schema = 'public'
),
constraints AS (
    SELECT 'CONSTRAINT: ' || conname || ' -> ' || pg_get_constraintdef(c.oid) as audit_item
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = 'profiles' AND n.nspname = 'public'
),
panic_logs AS (
    SELECT 'PANIC_LOG [' || created_at::text || ']: ' || error_message as audit_item
    FROM public.auth_panic_logs
    ORDER BY created_at DESC
    LIMIT 3
)
SELECT audit_item FROM auth_triggers
UNION ALL
SELECT '-----------------------------------'
UNION ALL
SELECT audit_item FROM profile_triggers
UNION ALL
SELECT '-----------------------------------'
UNION ALL
SELECT audit_item FROM constraints
UNION ALL
SELECT '-----------------------------------'
UNION ALL
SELECT audit_item FROM panic_logs;
