-- ADMIN_UPDATE_PLAN.sql
-- Purpose: Allow admins (or simulated admins) to update user plans.
-- Bypasses RLS "Users can only update their own profile".

BEGIN;

CREATE OR REPLACE FUNCTION admin_update_user_plan(
    p_user_id UUID,
    p_plan TEXT,
    p_expiry_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expiry TIMESTAMPTZ;
BEGIN
    -- (Optional) Add Admin Check Here if 'role' column exists
    -- IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN') THEN
    --    RETURN jsonb_build_object('success', false, 'error', 'Access Denied');
    -- END IF;

    -- Calculate Expiry
    IF p_plan = 'FREE' THEN
        v_expiry := NULL;
    ELSE
        v_expiry := NOW() + (p_expiry_days || ' days')::INTERVAL;
    END IF;

    -- Update Target Profile
    UPDATE profiles
    SET 
        subscription_plan = p_plan,
        subscription_expiry = v_expiry,
        is_premium = (p_plan <> 'FREE')
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'plan', p_plan, 
        'expiry', v_expiry
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMIT;
