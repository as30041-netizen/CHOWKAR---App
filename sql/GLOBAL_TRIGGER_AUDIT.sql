-- ============================================
-- GLOBAL TRIGGER AUDIT
-- ============================================
-- Since specific lookups are failing, let's list EVERYTHING.
-- This will tell us if triggers are running under different names.
-- ============================================

SELECT 
    tgname as "Trigger Name",
    tgrelid::regclass as "Table",
    tgenabled as "Status"
FROM pg_trigger
WHERE tgisinternal = FALSE
ORDER BY tgrelid::regclass::text, tgname;
