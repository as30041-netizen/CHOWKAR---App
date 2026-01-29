-- ADMIN_ACTIONS.sql
-- Purpose: Add ability for Admins to Suspend Users and Send Warnings.

BEGIN;

-- 1. Add Suspension Column (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_suspended') THEN
        ALTER TABLE public.profiles ADD COLUMN is_suspended BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. RPC: Suspend User (Toggle)
CREATE OR REPLACE FUNCTION admin_toggle_suspension(
    p_user_id UUID,
    p_suspended BOOLEAN,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- (Optional) Check Admin Role
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN') THEN
       RETURN jsonb_build_object('success', false, 'error', 'Access Denied');
    END IF;

    -- Update Profile
    UPDATE profiles
    SET is_suspended = p_suspended
    WHERE id = p_user_id;

    -- If suspending, maybe log it or send a final notification?
    -- For now, just the flag is enough. Frontend will block login.

    RETURN jsonb_build_object('success', true, 'status', CASE WHEN p_suspended THEN 'SUSPENDED' ELSE 'ACTIVE' END);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- 3. RPC: Send Warning (Admin Broadcast)
CREATE OR REPLACE FUNCTION admin_send_warning(
    p_user_id UUID,
    p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check Admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN') THEN
       RETURN jsonb_build_object('success', false, 'error', 'Access Denied');
    END IF;

    -- Insert Notification
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        read,
        timestamp
    ) VALUES (
        p_user_id,
        'Admin Warning',
        p_message,
        'WARNING', -- Verified type
        false,
        EXTRACT(EPOCH FROM NOW()) * 1000
    );

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMIT;
