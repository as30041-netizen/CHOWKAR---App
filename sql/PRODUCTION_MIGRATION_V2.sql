-- ============================================================================
-- CHOWKAR PRODUCTION MIGRATION v2.0
-- Consolidated SQL with all bug fixes from Jan 14-15, 2026
-- Run this ONCE in your production Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- SECTION 1: CLEAN UP OLD FUNCTIONS
-- Dynamic drop to handle any existing overloaded versions
-- ============================================================================

DO $$
DECLARE
    func_name TEXT;
    rec RECORD;
BEGIN
    FOREACH func_name IN ARRAY ARRAY['get_home_feed', 'get_job_bids', 'get_my_applications_feed', 'admin_activate_premium', 'delete_user_account_safe'] LOOP
        FOR rec IN 
            SELECT pg_get_functiondef(oid) as funcdef, 
                   proname || '(' || pg_get_function_identity_arguments(oid) || ')' as full_signature
            FROM pg_proc 
            WHERE proname = func_name 
            AND pronamespace = 'public'::regnamespace
        LOOP
            EXECUTE 'DROP FUNCTION IF EXISTS ' || rec.full_signature || ' CASCADE';
            RAISE NOTICE 'Dropped: %', rec.full_signature;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- SECTION 2: CREATE/UPDATE ALL RPCs
-- ============================================================================

-- 2.1 GET_HOME_FEED - Worker's job discovery feed
-- FIX: job_date is DATE not TIMESTAMPTZ
CREATE OR REPLACE FUNCTION get_home_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_category TEXT DEFAULT NULL,
    p_search_query TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    poster_id UUID,
    poster_name TEXT,
    poster_photo TEXT,
    poster_phone TEXT,
    title TEXT,
    description TEXT,
    category TEXT,
    location TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    job_date DATE,
    duration TEXT,
    budget INTEGER,
    status TEXT,
    image TEXT,
    created_at TIMESTAMPTZ,
    bid_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.id,
        j.poster_id,
        p.name AS poster_name,
        p.profile_photo AS poster_photo,
        p.phone AS poster_phone,
        j.title,
        j.description,
        j.category,
        j.location,
        j.latitude,
        j.longitude,
        j.job_date,
        j.duration,
        j.budget,
        j.status::TEXT,
        j.image,
        j.created_at,
        COALESCE((SELECT COUNT(*)::INTEGER FROM bids b2 WHERE b2.job_id = j.id), 0) AS bid_count
    FROM jobs j
    JOIN profiles p ON j.poster_id = p.id
    LEFT JOIN user_job_visibility ujv ON ujv.job_id = j.id AND ujv.user_id = p_user_id
    WHERE 
        j.status = 'OPEN'
        AND j.job_date >= CURRENT_DATE -- Auto-filter expired jobs in view
        AND j.poster_id != p_user_id
        -- Blocked Users check: Filter out jobs from users you blocked or users who blocked you
        AND NOT EXISTS (
            SELECT 1 FROM user_blocks ub 
            WHERE (ub.blocker_id = p_user_id AND ub.blocked_id = j.poster_id)
               OR (ub.blocker_id = j.poster_id AND ub.blocked_id = p_user_id)
        )
        -- Already bid check
        AND NOT EXISTS (
            SELECT 1 FROM bids b 
            WHERE b.job_id = j.id 
            AND b.worker_id = p_user_id
        )
        AND (ujv.is_hidden IS NULL OR ujv.is_hidden = FALSE)
        AND (p_category IS NULL OR p_category = '' OR j.category = p_category)
        AND (p_search_query IS NULL OR p_search_query = '' OR (
            j.title ILIKE '%' || p_search_query || '%' OR 
            j.description ILIKE '%' || p_search_query || '%'
        ))
    ORDER BY j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 2.2 GET_JOB_BIDS - Secure bid access
-- FIX: Fully qualified column names to avoid ambiguity
CREATE OR REPLACE FUNCTION get_job_bids(p_job_id UUID)
RETURNS TABLE (
    id UUID,
    job_id UUID,
    worker_id UUID,
    worker_name TEXT,
    worker_photo TEXT,
    worker_phone TEXT,
    worker_rating NUMERIC,
    amount INTEGER,
    message TEXT,
    status TEXT,
    negotiation_history JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_job_poster_id UUID;
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();
    SELECT j.poster_id INTO v_job_poster_id FROM jobs j WHERE j.id = p_job_id;

    RETURN QUERY
    SELECT 
        b.id,
        b.job_id,
        b.worker_id,
        p.name AS worker_name,
        p.profile_photo AS worker_photo,
        p.phone AS worker_phone,
        p.rating AS worker_rating,
        b.amount,
        b.message,
        b.status::TEXT,
        b.negotiation_history,
        b.created_at,
        b.updated_at
    FROM bids b
    JOIN profiles p ON b.worker_id = p.id
    WHERE b.job_id = p_job_id
      AND (v_caller_id = v_job_poster_id OR b.worker_id = v_caller_id)
    ORDER BY b.created_at DESC;
END;
$$;

-- 2.3 GET_MY_APPLICATIONS_FEED - Optimized worker applications view
CREATE OR REPLACE FUNCTION get_my_applications_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    job_id UUID,
    poster_id UUID,
    poster_name TEXT,
    poster_photo TEXT,
    job_title TEXT,
    job_description TEXT,
    job_category TEXT,
    job_location TEXT,
    job_budget INTEGER,
    job_status TEXT,
    job_created_at TIMESTAMPTZ,
    bid_id UUID,
    bid_amount INTEGER,
    bid_status TEXT,
    bid_message TEXT,
    bid_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.id AS job_id,
        j.poster_id,
        p.name AS poster_name,
        p.profile_photo AS poster_photo,
        j.title AS job_title,
        j.description AS job_description,
        j.category AS job_category,
        j.location AS job_location,
        j.budget AS job_budget,
        j.status::TEXT AS job_status,
        j.created_at AS job_created_at,
        b.id AS bid_id,
        b.amount AS bid_amount,
        b.status::TEXT AS bid_status,
        b.message AS bid_message,
        b.created_at AS bid_created_at
    FROM bids b
    JOIN jobs j ON b.job_id = j.id
    JOIN profiles p ON j.poster_id = p.id
    LEFT JOIN user_job_visibility ujv ON ujv.job_id = j.id AND ujv.user_id = p_user_id
    WHERE b.worker_id = p_user_id
      AND (ujv.is_hidden IS NULL OR ujv.is_hidden = FALSE)
    ORDER BY b.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 2.4 ADMIN_ACTIVATE_PREMIUM - Secure premium upgrade
CREATE OR REPLACE FUNCTION admin_activate_premium(
    p_user_id UUID,
    p_amount INTEGER DEFAULT 499
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    UPDATE profiles 
    SET is_premium = TRUE, updated_at = NOW()
    WHERE id = p_user_id;

    INSERT INTO wallet_transactions (
        id, user_id, amount, transaction_type, description, status, created_at
    ) VALUES (
        gen_random_uuid(),
        p_user_id,
        p_amount,
        'PREMIUM_UPGRADE',
        'Lifetime Premium Membership',
        'COMPLETED',
        NOW()
    );

    v_result := jsonb_build_object(
        'success', TRUE,
        'message', 'Premium activated successfully',
        'user_id', p_user_id
    );
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    v_result := jsonb_build_object(
        'success', FALSE,
        'message', SQLERRM
    );
    RETURN v_result;
END;
$$;

-- 2.5 DELETE_USER_ACCOUNT_SAFE - PII purging for account deletion
CREATE OR REPLACE FUNCTION delete_user_account_safe(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Unauthorized');
    END IF;

    UPDATE profiles SET
        name = 'Deleted User',
        phone = NULL,
        bio = NULL,
        profile_photo = NULL,
        location = NULL,
        latitude = NULL,
        longitude = NULL,
        skills = ARRAY[]::TEXT[],
        experience = NULL,
        fcm_token = NULL,
        is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = p_user_id;

    UPDATE jobs SET
        status = 'CANCELLED'
    WHERE poster_id = p_user_id AND status = 'OPEN';

    v_result := jsonb_build_object('success', TRUE, 'message', 'Account deleted');
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    v_result := jsonb_build_object('success', FALSE, 'message', SQLERRM);
    RETURN v_result;
END;
$$;

-- ============================================================================
-- SECTION 3: CREATE REQUIRED TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS processed_webhooks (
    id TEXT PRIMARY KEY,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 4: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_home_feed TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_bids TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_applications_feed TO authenticated;
GRANT EXECUTE ON FUNCTION admin_activate_premium TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_account_safe TO authenticated;

-- ============================================================================
-- SECTION 4: PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_jobs_status_poster ON jobs(status, poster_id);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_bids_job_worker ON bids(job_id, worker_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_job_created ON chat_messages(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_blocks_both ON user_blocks(blocker_id, blocked_id);

-- ============================================================================
-- SECTION 5: VERIFICATION
-- ============================================================================

SELECT 'MIGRATION COMPLETE ✅' AS status;
SELECT proname as function_name 
FROM pg_proc 
WHERE proname IN ('get_home_feed', 'get_job_bids', 'get_my_applications_feed', 'admin_activate_premium', 'delete_user_account_safe')
AND pronamespace = 'public'::regnamespace
ORDER BY proname;
