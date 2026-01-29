-- ==========================================
-- COMPREHENSIVE SUBSCRIPTION SERVICE
-- Phase 1: Core Service - Single Source of Truth
-- ==========================================

BEGIN;

-- 1. Create subscription history audit table
CREATE TABLE IF NOT EXISTS subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    old_plan TEXT,
    new_plan TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('PAYMENT', 'ADMIN', 'EXPIRY', 'DOWNGRADE')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_user ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created ON subscription_history(created_at DESC);

-- 2. Create unified subscription update function
CREATE OR REPLACE FUNCTION update_user_subscription(
    p_user_id UUID,
    p_new_plan TEXT,
    p_source TEXT,  -- 'PAYMENT', 'ADMIN', 'EXPIRY', 'DOWNGRADE'
    p_duration_days INTEGER DEFAULT 30,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_plan TEXT;
    v_expiry TIMESTAMPTZ;
    v_user_exists BOOLEAN;
BEGIN
    -- Validate plan
    IF p_new_plan NOT IN ('FREE', 'WORKER_PLUS', 'PRO_POSTER', 'SUPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid plan: ' || p_new_plan);
    END IF;
    
    -- Check if user exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id) INTO v_user_exists;
    IF NOT v_user_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
    
    -- Get current plan
    SELECT subscription_plan INTO v_old_plan FROM profiles WHERE id = p_user_id;
    
    -- Calculate expiry
    v_expiry := CASE 
        WHEN p_new_plan = 'FREE' THEN NULL
        ELSE NOW() + (p_duration_days || ' days')::INTERVAL
    END;
    
    -- Update profile
    UPDATE profiles
    SET 
        subscription_plan = p_new_plan,
        subscription_expiry = v_expiry,
        is_premium = (p_new_plan != 'FREE'),
        -- Verified badge for WORKER_PLUS and SUPER users
        verified = CASE 
            WHEN p_new_plan IN ('WORKER_PLUS', 'SUPER') THEN true
            ELSE verified 
        END,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Log the change to history
    INSERT INTO subscription_history (user_id, old_plan, new_plan, source, metadata, created_at)
    VALUES (p_user_id, v_old_plan, p_new_plan, p_source, p_metadata, NOW());
    
    -- Notification is auto-triggered by NOTIFY_PLAN_CHANGES trigger
    
    RETURN jsonb_build_object(
        'success', true,
        'old_plan', COALESCE(v_old_plan, 'FREE'),
        'new_plan', p_new_plan,
        'expiry', v_expiry,
        'source', p_source
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3. Grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_subscription TO service_role;

-- 4. Test with a simple query (optional - comment out for production)
-- SELECT update_user_subscription(
--     (SELECT id FROM profiles LIMIT 1),
--     'FREE',
--     'ADMIN',
--     30,
--     '{"test": true}'::jsonb
-- );

COMMIT;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Check subscription history table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'subscription_history';

-- Check function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'update_user_subscription';

-- View recent subscription changes
-- SELECT * FROM subscription_history ORDER BY created_at DESC LIMIT 10;
