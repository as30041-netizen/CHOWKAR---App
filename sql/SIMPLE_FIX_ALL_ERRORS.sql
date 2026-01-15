-- ============================================================================
-- CHOWKAR SIMPLE DATABASE MIGRATION (NO DROP - ONLY CREATE)
-- Run this AFTER running CLEAN_DROP_ALL_FUNCTIONS.sql
-- ============================================================================

-- ============================================================================  
-- 1. GET HOME FEED RPC (Fixes 404 error)
-- ============================================================================
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
    job_date TIMESTAMPTZ,
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
        COALESCE((SELECT COUNT(*)::INTEGER FROM bids WHERE job_id = j.id), 0) AS bid_count
    FROM jobs j
    JOIN profiles p ON j.poster_id = p.id
    LEFT JOIN user_job_visibility ujv ON ujv.job_id = j.id AND ujv.user_id = p_user_id
    WHERE 
        j.status = 'OPEN'
        AND j.poster_id != p_user_id
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

-- ============================================================================
-- 2. GET JOB BIDS RPC (Fixes 400 Access Denied error)
-- FIXED: Now allows both job poster AND workers to view bids
-- ============================================================================
CREATE OR REPLACE FUNCTION get_job_bids(p_job_id UUID)
RETURNS TABLE (
    id UUID,
    job_id UUID,
    worker_id UUID,
    worker_name TEXT,
    worker_phone TEXT,
    worker_rating NUMERIC,
    worker_location TEXT,
    worker_latitude NUMERIC,
    worker_longitude NUMERIC,
    worker_photo TEXT,
    amount INTEGER,
    message TEXT,
    status TEXT,
    negotiation_history JSONB,
    created_at TIMESTAMPTZ,
    poster_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_poster_id UUID;
    v_current_user_id UUID := auth.uid();
    v_user_has_bid BOOLEAN;
BEGIN
    -- Get the job poster ID
    SELECT j.poster_id INTO v_target_poster_id 
    FROM jobs j 
    WHERE j.id = p_job_id;
    
    -- Check if current user has a bid on this job
    SELECT EXISTS(
        SELECT 1 FROM bids 
        WHERE job_id = p_job_id 
        AND worker_id = v_current_user_id
    ) INTO v_user_has_bid;
    
    -- FIXED Security: Allow if user is EITHER the poster OR has a bid
    IF v_target_poster_id != v_current_user_id AND NOT v_user_has_bid THEN
        RAISE EXCEPTION 'Access Denied: You must be the job poster or have a bid to view bids';
    END IF;

    -- Return bids
    RETURN QUERY 
    SELECT 
        b.id,
        b.job_id,
        b.worker_id,
        COALESCE(p.name, 'Unknown Worker') as worker_name,
        p.phone as worker_phone,
        p.rating as worker_rating,
        p.location as worker_location,
        p.latitude as worker_latitude,
        p.longitude as worker_longitude,
        p.profile_photo as worker_photo,
        b.amount,
        b.message,
        b.status::TEXT,
        b.negotiation_history,
        b.created_at,
        v_target_poster_id AS poster_id
    FROM bids b
    LEFT JOIN profiles p ON b.worker_id = p.id
    WHERE b.job_id = p_job_id
    ORDER BY b.created_at DESC;
END;
$$;

-- ============================================================================
-- 3. GET MY APPLICATIONS FEED RPC (New optimized feed)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_my_applications_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(t) INTO v_result
    FROM (
        SELECT 
            j.*,
            b.id AS my_bid_id,
            b.status AS my_bid_status,
            b.amount AS my_bid_amount,
            (b.negotiation_history->-1->>'by') AS my_bid_last_negotiation_by,
            (SELECT COUNT(*) FROM bids WHERE job_id = j.id) AS bid_count
        FROM bids b
        JOIN jobs j ON b.job_id = j.id
        LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
        WHERE b.worker_id = p_user_id
          AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
        ORDER BY b.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) t;
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ============================================================================
-- 4. ACTIVATE PREMIUM RPC (For subscription flow)
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_activate_premium(
    p_event_id TEXT,
    p_user_id UUID,
    p_order_id TEXT,
    p_raw_event JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Idempotency check
    IF EXISTS (SELECT 1 FROM processed_webhooks WHERE event_id = p_event_id) THEN
        RETURN json_build_object('success', true, 'message', 'Event already processed', 'idempotent', true);
    END IF;

    -- Activate premium
    UPDATE profiles SET is_premium = true, updated_at = NOW() WHERE id = p_user_id;

    -- Record transaction
    INSERT INTO wallet_transactions (wallet_id, amount, type, description)
    VALUES (p_user_id, 0, 'PURCHASE', 'Premium Upgrade (Order: ' || p_order_id || ')');

    -- Mark webhook as processed
    INSERT INTO processed_webhooks (event_id, payload) VALUES (p_event_id, p_raw_event);

    RETURN json_build_object('success', true, 'is_premium', true);
END;
$$;

-- ============================================================================
-- 5. DELETE USER ACCOUNT SAFELY (PII Purge)
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_user_account_safe(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Wipe PII
    UPDATE profiles
    SET 
        name = 'Deleted User',
        email = NULL,
        phone = NULL,
        profile_photo = NULL,
        location = 'N/A',
        push_token = NULL,
        bio = 'This account has been closed.',
        is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Close active jobs
    UPDATE jobs SET status = 'CANCELLED' WHERE poster_id = p_user_id AND status = 'OPEN';
    
    -- Withdraw pending bids
    UPDATE bids SET status = 'REJECTED' WHERE worker_id = p_user_id AND status = 'PENDING';

    RETURN jsonb_build_object('success', true, 'message', 'Account deactivated and PII purged');
END;
$$;

-- ============================================================================
-- 6. CREATE PROCESSED_WEBHOOKS TABLE (If not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS processed_webhooks (
    event_id TEXT PRIMARY KEY,
    payload JSONB,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 7. GRANT EXECUTE PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_home_feed TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_bids TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_applications_feed TO authenticated;
GRANT EXECUTE ON FUNCTION admin_activate_premium TO service_role;
GRANT EXECUTE ON FUNCTION delete_user_account_safe TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE ✅
-- Your app should now work without 404 or 400 errors
-- ============================================================================
