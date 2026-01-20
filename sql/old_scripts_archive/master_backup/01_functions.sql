-- ============================================================================
-- CHOWKAR MASTER FUNCTIONS (01_functions.sql)
-- Consolidated RPCs & Triggers - Jan 2026
-- ============================================================================

-- ============================================
-- 1. HOME FEED & JOB DISCOVERY
-- ============================================

-- Worker's job discovery feed with filtering, search, and blocking logic
DROP FUNCTION IF EXISTS get_home_feed(uuid, integer, integer, text, text);
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
        AND j.job_date >= CURRENT_DATE
        AND j.poster_id != p_user_id
        -- Blocked Users check
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


-- ============================================
-- 2. BIDDING SYSTEM
-- ============================================

-- Secure bid access for both Poster and Worker
DROP FUNCTION IF EXISTS get_job_bids(uuid);
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
    SELECT j.poster_id INTO v_target_poster_id FROM jobs j WHERE j.id = p_job_id;
    
    SELECT EXISTS(
        SELECT 1 FROM bids 
        WHERE job_id = p_job_id AND worker_id = v_current_user_id
    ) INTO v_user_has_bid;
    
    -- Security verification
    IF v_target_poster_id != v_current_user_id AND NOT v_user_has_bid THEN
        RAISE EXCEPTION 'Access Denied: You must be the job poster or have a bid to view bids';
    END IF;

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

-- Accept a bid
DROP FUNCTION IF EXISTS accept_bid(uuid, uuid, uuid, uuid, integer, integer);
CREATE OR REPLACE FUNCTION accept_bid(
  p_job_id UUID,
  p_bid_id UUID,
  p_poster_id UUID,
  p_worker_id UUID,
  p_amount INTEGER,
  p_poster_fee INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_job RECORD;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id AND poster_id = p_poster_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found or unauthorized'; END IF;
  IF v_job.status != 'OPEN' THEN RAISE EXCEPTION 'Job is not open'; END IF;
  
  -- Accept target bid
  UPDATE bids SET status = 'ACCEPTED', accepted_at = NOW(), updated_at = NOW()
  WHERE id = p_bid_id AND job_id = p_job_id;
  
  -- Reject others
  UPDATE bids SET status = 'REJECTED', updated_at = NOW()
  WHERE job_id = p_job_id AND id != p_bid_id AND status = 'PENDING';
  
  -- Update Job
  UPDATE jobs SET status = 'IN_PROGRESS', accepted_bid_id = p_bid_id, updated_at = NOW()
  WHERE id = p_job_id;
  
  RETURN json_build_object('success', true, 'bid_id', p_bid_id);
END;
$$;


-- ============================================
-- 2.1 SECURE BIDDING ACTIONS (No Direct Inserts)
-- ============================================

-- ACTION: PLACE BID (Standard)
-- Deducts 1 Coin and notifies poster
DROP FUNCTION IF EXISTS action_place_bid(uuid, integer, text);
CREATE OR REPLACE FUNCTION action_place_bid(
    p_job_id UUID,
    p_amount INTEGER,
    p_message TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_status TEXT;
    v_poster_id UUID;
    v_job_title TEXT;
    v_new_bid_id UUID;
    v_worker_id UUID := auth.uid();
    v_current_balance INTEGER;
    v_bid_cost INTEGER := 1;
BEGIN
    -- Validation
    IF p_amount <= 0 THEN RETURN json_build_object('success', false, 'error', 'Bid amount must be positive'); END IF;
    
    SELECT status, poster_id, title INTO v_job_status, v_poster_id, v_job_title FROM jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job is not open'); END IF;
    IF v_poster_id = v_worker_id THEN RETURN json_build_object('success', false, 'error', 'Cannot bid on own job'); END IF;
    
    -- Check Double Bid
    IF EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id AND worker_id = v_worker_id) THEN
        RETURN json_build_object('success', false, 'error', 'Already bid on this job');
    END IF;

    -- Check Wallet Balance (Atomic Lock)
    SELECT balance INTO v_current_balance 
    FROM wallets 
    WHERE user_id = v_worker_id 
    FOR UPDATE;
    
    -- Handle missing wallet
    IF v_current_balance IS NULL THEN
        INSERT INTO wallets (user_id, balance) VALUES (v_worker_id, 0)
        RETURNING balance INTO v_current_balance;
    END IF;
    
    IF v_current_balance < v_bid_cost THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient coins. Please top up your wallet.');
    END IF;

    -- Deduct Coin
    UPDATE wallets 
    SET balance = balance - v_bid_cost,
        updated_at = NOW()
    WHERE user_id = v_worker_id;
    
    -- Record Transaction
    INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, description)
    VALUES (v_worker_id, -v_bid_cost, 'BID_FEE', 'Bid on Job: ' || v_job_title);

    -- Insert Bid
    INSERT INTO bids (job_id, worker_id, amount, message, status)
    VALUES (p_job_id, v_worker_id, p_amount, p_message, 'PENDING')
    RETURNING id INTO v_new_bid_id;

    -- Notify Poster
    INSERT INTO notifications (user_id, title, message, type, related_job_id, created_at)
    VALUES (
        v_poster_id, 
        'New Bid Received', 
        'Someone bid ₹' || p_amount || ' on ' || v_job_title, 
        'INFO', 
        p_job_id, 
        NOW()
    );

    -- Broadcase/Trigger handled by Supabase Realtime roughly, but strictly handled by Client subscribe
    
    RETURN json_build_object(
        'success', true, 
        'bid_id', v_new_bid_id, 
        'coins_remaining', v_current_balance - v_bid_cost
    );
END;
$$;


-- ACTION: COUNTER BID (Negotiation)
-- Updates bid amount and history securely
DROP FUNCTION IF EXISTS action_counter_bid(uuid, numeric, text);
CREATE OR REPLACE FUNCTION action_counter_bid(
    p_bid_id UUID,
    p_amount NUMERIC,
    p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bid RECORD;
    v_job RECORD;
    v_user_role TEXT;
    v_negotiation_entry JSONB;
BEGIN
    -- Validation
    IF p_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive'); END IF;

    -- Verify Bid & Job
    SELECT * INTO v_bid FROM bids WHERE id = p_bid_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found'); END IF;

    SELECT * INTO v_job FROM jobs WHERE id = v_bid.job_id;
    IF v_job.status != 'OPEN' THEN RETURN jsonb_build_object('success', false, 'error', 'Job is no longer open'); END IF;

    -- Authorize
    IF auth.uid() = v_bid.worker_id THEN
        v_user_role := 'WORKER';
    ELSIF auth.uid() = v_job.poster_id THEN
        v_user_role := 'POSTER';
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Log Entry
    v_negotiation_entry := jsonb_build_object(
        'by', v_user_role,
        'amount', p_amount,
        'message', p_message,
        'at', extract(epoch from now()) * 1000
    );

    -- Update Bid
    UPDATE bids
    SET 
        amount = p_amount,
        message = p_message,
        negotiation_history = COALESCE(negotiation_history, '[]'::jsonb) || v_negotiation_entry,
        status = 'PENDING',
        updated_at = now()
    WHERE id = p_bid_id;

    -- Notify Recipient
    INSERT INTO notifications (user_id, title, message, type, related_job_id, link, created_at)
    VALUES (
        CASE WHEN v_user_role = 'WORKER' THEN v_job.poster_id ELSE v_bid.worker_id END, 
        'New Counter Offer', 
        CASE WHEN v_user_role = 'WORKER' THEN 'Worker' ELSE 'Employer' END || ' sent a counter offer of ₹' || p_amount || ' for ' || v_job.title, 
        'OFFER',
        v_job.id,
        '/job/' || v_job.id, 
        now()
    );

    RETURN jsonb_build_object('success', true);
END;
$$;


-- ACTION: REJECT BID (Explicit)
-- Poster rejects a specific bid
DROP FUNCTION IF EXISTS action_reject_bid(uuid);
CREATE OR REPLACE FUNCTION action_reject_bid(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bid RECORD;
    v_job RECORD;
BEGIN
    SELECT * INTO v_bid FROM bids WHERE id = p_bid_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found'); END IF;

    SELECT * INTO v_job FROM jobs WHERE id = v_bid.job_id;
    
    IF auth.uid() != v_job.poster_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    UPDATE bids SET status = 'REJECTED', updated_at = now() WHERE id = p_bid_id;

    -- Notify Worker
    INSERT INTO notifications (user_id, title, message, type, related_job_id, link, created_at)
    VALUES (
        v_bid.worker_id, 
        'Bid Update', 
        'The employer chose a different worker for "' || v_job.title || '". Don''t give up!', 
        'INFO', 
        v_job.id,
        '/job/' || v_job.id, 
        now()
    );

    RETURN jsonb_build_object('success', true);
END;
$$;


-- ============================================
-- 3. WORKER DASHBOARD
-- ============================================

-- 4b. GET_MY_JOBS_FEED (Poster Dashboard) - Enhanced with Worker Phone
DROP FUNCTION IF EXISTS get_my_jobs_feed(uuid, integer, integer);
CREATE OR REPLACE FUNCTION get_my_jobs_feed(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT, poster_rating NUMERIC,
  title TEXT, description TEXT, category TEXT, location TEXT, latitude NUMERIC, longitude NUMERIC,
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT,
  created_at TIMESTAMPTZ, bid_count BIGINT, accepted_bid_id UUID,
  action_required_count BIGINT, has_new_bid BOOLEAN, has_my_review BOOLEAN,
  hired_worker_name TEXT, hired_worker_phone TEXT, hired_worker_id UUID
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, p.name as poster_name, p.profile_photo as poster_photo, p.rating as poster_rating,
    j.title, j.description, j.category, j.location, j.latitude, j.longitude,
    j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.created_at,
    (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
    j.accepted_bid_id,
    (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id AND b.status = 'PENDING') as action_required_count,
    EXISTS (SELECT 1 FROM bids b2 WHERE b2.job_id = j.id AND b2.status = 'PENDING' AND b2.created_at > (NOW() - INTERVAL '24 hours')) as has_new_bid,
    EXISTS (SELECT 1 FROM reviews r WHERE r.job_id = j.id AND r.reviewer_id = p_user_id) as has_my_review,
    -- New Fields for Hired Worker
    w.name as hired_worker_name,
    w.phone as hired_worker_phone,
    w.id as hired_worker_id
  FROM jobs j
  JOIN profiles p ON p.id = j.poster_id
  LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
  -- Join to get hired worker details if job is IN_PROGRESS/COMPLETED
  LEFT JOIN bids b_accepted ON b_accepted.id = j.accepted_bid_id
  LEFT JOIN profiles w ON w.id = b_accepted.worker_id
  WHERE j.poster_id = p_user_id
    AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
  ORDER BY j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
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


-- ============================================
-- 4. WALLET & PAYMENTS
-- ============================================

DROP FUNCTION IF EXISTS process_transaction(integer, text, text);
CREATE OR REPLACE FUNCTION process_transaction(
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_new_balance INTEGER;
  v_txn_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  UPDATE wallets
  SET balance = balance + (CASE WHEN p_type = 'CREDIT' THEN p_amount ELSE -p_amount END),
      updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_new_balance;
  
  IF v_new_balance < 0 THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  
  INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, description)
  VALUES (v_user_id, p_amount, p_type, p_description)
  RETURNING id INTO v_txn_id;
  
  RETURN json_build_object('success', true, 'new_balance', v_new_balance, 'txn_id', v_txn_id);
END;
$$;

-- Activate Premium (Webhook)
DROP FUNCTION IF EXISTS admin_activate_premium(text, uuid, text, jsonb);
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
    IF EXISTS (SELECT 1 FROM processed_webhooks WHERE id = p_event_id) THEN
        RETURN json_build_object('success', true, 'message', 'Idempotent skip');
    END IF;

    UPDATE profiles SET is_premium = true, updated_at = NOW() WHERE id = p_user_id;

    INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, description)
    VALUES (p_user_id, 0, 'PURCHASE', 'Premium Upgrade');

    INSERT INTO processed_webhooks (id, payload) VALUES (p_event_id, p_raw_event);

    RETURN json_build_object('success', true);
END;
$$;


-- ============================================
-- 5. CHAT & NOTIFICATIONS
-- ============================================

CREATE OR REPLACE FUNCTION mark_messages_read(p_job_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE notifications
  SET read = TRUE, updated_at = NOW()
  WHERE user_id = p_user_id
    AND related_job_id = p_job_id
    AND type = 'INFO'
    AND title LIKE '%Message%';
END;
$$;

CREATE OR REPLACE FUNCTION soft_delete_chat_message(p_message_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE chat_messages SET is_deleted = TRUE 
  WHERE id = p_message_id AND sender_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION soft_delete_review(p_review_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE reviews SET is_deleted = TRUE 
  WHERE id = p_review_id AND reviewer_id = auth.uid();
END;
$$;


-- ============================================
-- 6. ACCOUNT MANAGEMENT (GDPR/Safety)
-- ============================================

CREATE OR REPLACE FUNCTION delete_user_account_safe(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE profiles
    SET name = 'Deleted User', email = NULL, phone = NULL, profile_photo = NULL,
        location = 'N/A', push_token = NULL, bio = 'Closed', is_deleted = TRUE, updated_at = NOW()
    WHERE id = p_user_id;

    UPDATE jobs SET status = 'CANCELLED' WHERE poster_id = p_user_id AND status = 'OPEN';
    UPDATE bids SET status = 'REJECTED' WHERE worker_id = p_user_id AND status = 'PENDING';
    
    RETURN jsonb_build_object('success', true);
END;
$$;


-- ============================================
-- 7. ANALYTICS & MAINTENANCE
-- ============================================

-- Calculate Dashboard Stats
DROP FUNCTION IF EXISTS get_dashboard_stats(uuid);
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_poster_active INTEGER;
    v_poster_history INTEGER;
    v_worker_active INTEGER;
    v_worker_history INTEGER;
BEGIN
    -- 1. Poster Active: Jobs I posted that are NOT completed/cancelled
    SELECT COUNT(*) INTO v_poster_active
    FROM jobs
    WHERE poster_id = p_user_id
      AND status NOT IN ('COMPLETED', 'CANCELLED', 'HIDDEN');

    -- 2. Poster History: Jobs I posted that ARE completed or cancelled (and not hidden)
    SELECT COUNT(*) INTO v_poster_history
    FROM jobs
    WHERE poster_id = p_user_id
      AND status IN ('COMPLETED', 'CANCELLED')
      AND status != 'HIDDEN';

    -- 3. Worker Active: Jobs I've bid on that are still "active" for me
    SELECT COUNT(DISTINCT j.id) INTO v_worker_active
    FROM jobs j
    JOIN bids b ON b.job_id = j.id
    LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
    WHERE b.worker_id = p_user_id
      AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
      AND (
          (j.status = 'OPEN' AND b.status IN ('PENDING', 'ACCEPTED'))
          OR 
          (j.status = 'IN_PROGRESS' AND (j.accepted_bid_id = b.id OR b.status = 'ACCEPTED'))
      );

    -- 4. Worker History: Jobs/Bids that are finished
    SELECT COUNT(DISTINCT j.id) INTO v_worker_history
    FROM jobs j
    JOIN bids b ON b.job_id = j.id
    LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
    WHERE b.worker_id = p_user_id
      AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
      AND (
          b.status = 'REJECTED'
          OR j.status IN ('COMPLETED', 'CANCELLED')
          OR (j.status != 'OPEN' AND j.accepted_bid_id IS DISTINCT FROM b.id AND b.status != 'ACCEPTED')
      );

    RETURN jsonb_build_object(
        'poster_active', v_poster_active,
        'poster_history', v_poster_history,
        'worker_active', v_worker_active,
        'worker_history', v_worker_history
    );
END;
$$;

CREATE OR REPLACE FUNCTION log_ai_usage(p_feature TEXT, p_tokens INTEGER DEFAULT 0)
RETURNS VOID AS $$
BEGIN
    INSERT INTO ai_usage_logs (user_id, feature, input_tokens)
    VALUES (auth.uid(), p_feature, p_tokens);
    UPDATE profiles SET ai_usage_count = COALESCE(ai_usage_count, 0) + 1 WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
