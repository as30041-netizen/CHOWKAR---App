-- ==========================================
-- PHASE 3: ADMIN CONTROLS UPDATE
-- Update admin controls to use unified subscription service
-- ==========================================

-- Drop old function first
DROP FUNCTION IF EXISTS admin_update_user_plan(uuid, text, integer);

-- Update admin_update_user_plan RPC to use the new unified service
CREATE OR REPLACE FUNCTION admin_update_user_plan(
    p_user_id UUID,
    p_plan TEXT,
    p_duration_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_result JSONB;
BEGIN
    -- Get current admin user ID from session
    v_admin_id := auth.uid();
    
    -- Call unified subscription service
    SELECT update_user_subscription(
        p_user_id,
        p_plan,
        'ADMIN',
        p_duration_days,
        jsonb_build_object(
            'admin_id', v_admin_id,
            'method', 'admin_panel'
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_update_user_plan TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user_plan TO service_role;
