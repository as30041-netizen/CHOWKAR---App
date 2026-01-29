-- ==========================================
-- DROP OLD admin_activate_premium FUNCTION
-- Description: Removes the old 2-parameter version that doesn't handle subscription_plan
-- ==========================================

-- Drop the old signature (2 parameters)
DROP FUNCTION IF EXISTS public.admin_activate_premium(uuid, integer);

-- Verify only the correct 4-parameter version remains
-- It should be: admin_activate_premium(text, uuid, text, jsonb)
