-- ============================================================================
-- CHOWKAR CONSOLIDATED FUNCTIONS (01_functions.sql)
-- Synthesized Jan 2026 from Phases 37, 44, 45, 47, DEPLOY
-- ============================================================================

-- ============================================
-- 1. HOME FEED (Deep Filtering + Personalization)
-- Source: 37_DEEP_FEED_FILTERING.sql
-- ============================================

DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION get_home_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_category TEXT DEFAULT NULL,
    p_search_query TEXT DEFAULT NULL,
    p_feed_mode TEXT DEFAULT 'RECOMMENDED',
    p_sort_by TEXT DEFAULT 'NEWEST',
    p_min_budget INTEGER DEFAULT NULL,
    p_max_distance INTEGER DEFAULT NULL,
    p_user_lat NUMERIC DEFAULT NULL,
    p_user_lng NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    poster_id UUID,
    poster_name TEXT,
    poster_photo TEXT,
    poster_rating NUMERIC,
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
    bid_count INTEGER,
    is_recommended BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_skills TEXT[];
    v_skill_pattern TEXT;
BEGIN
    SELECT skills INTO v_user_skills FROM profiles WHERE profiles.id = p_user_id;

    IF v_user_skills IS NOT NULL THEN
        SELECT string_agg(regexp_replace(skill, '([!$()*+.:<=>?[\\\]^{|}-])', '\\\1', 'g'), '|')
        INTO v_skill_pattern
        FROM unnest(v_user_skills) AS skill
        WHERE skill IS NOT NULL AND length(skill) > 0;
    END IF;

    RETURN QUERY
    SELECT 
        j.id, j.poster_id, p.name AS poster_name, p.profile_photo AS poster_photo,
        COALESCE(p.rating, 0.0)::NUMERIC AS poster_rating,
        j.title, j.description, j.category, j.location, j.latitude, j.longitude,
        j.job_date, j.duration, j.budget, j.status::TEXT, j.image, j.created_at, j.bid_count,
        (v_user_skills IS NOT NULL AND (
            j.category = ANY(v_user_skills) OR 
            (v_skill_pattern IS NOT NULL AND v_skill_pattern <> '' AND (j.title ~* v_skill_pattern OR j.description ~* v_skill_pattern))
        )) AS is_recommended
    FROM jobs j
    JOIN profiles p ON j.poster_id = p.id
    WHERE 
        j.status = 'OPEN' AND j.poster_id != p_user_id 
        AND NOT EXISTS (SELECT 1 FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id)
        AND (p_category IS NULL OR p_category = '' OR p_category = 'All' OR j.category = p_category)
        AND (p_search_query IS NULL OR p_search_query = '' OR (j.title ILIKE '%' || p_search_query || '%' OR j.description ILIKE '%' || p_search_query || '%'))
        AND (p_min_budget IS NULL OR j.budget >= p_min_budget)
        AND (p_max_distance IS NULL OR (p_user_lat IS NULL OR p_user_lng IS NULL) OR
            (6371 * acos(cos(radians(p_user_lat)) * cos(radians(j.latitude)) * cos(radians(j.longitude) - radians(p_user_lng)) + sin(radians(p_user_lat)) * sin(radians(j.latitude)))) <= p_max_distance)
    ORDER BY 
        CASE WHEN p_feed_mode = 'RECOMMENDED' THEN 
            ((CASE WHEN (v_user_skills IS NOT NULL AND (j.category = ANY(v_user_skills) OR (v_skill_pattern IS NOT NULL AND v_skill_pattern <> '' AND (j.title ~* v_skill_pattern OR j.description ~* v_skill_pattern)))) THEN 100 ELSE 0 END) +
             COALESCE(CASE WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN GREATEST(0, 50 - (6371 * acos(cos(radians(p_user_lat)) * cos(radians(j.latitude)) * cos(radians(j.longitude) - radians(p_user_lng)) + sin(radians(p_user_lat)) * sin(radians(j.latitude))))) ELSE 0 END, 0) +
             EXTRACT(EPOCH FROM (j.created_at - (NOW() - INTERVAL '7 days'))) / 30240)
        ELSE 0 END DESC NULLS LAST,
        CASE WHEN p_sort_by = 'BUDGET_HIGH' THEN j.budget END DESC NULLS LAST,
        CASE WHEN p_sort_by = 'BUDGET_LOW' THEN j.budget END ASC NULLS LAST,
        CASE WHEN p_sort_by = 'NEAREST' AND p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN 
            (6371 * acos(cos(radians(p_user_lat)) * cos(radians(j.latitude)) * cos(radians(j.longitude) - radians(p_user_lng)) + sin(radians(p_user_lat)) * sin(radians(j.latitude))))
        END ASC NULLS LAST,
        j.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;


-- ============================================
-- 2. POSTER FEED (Exact Signature Match)
-- Source: 47_FORCE_FIX_POSTER_FEED.sql
-- ============================================

DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID);
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_my_jobs_feed(
    p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT, poster_rating NUMERIC,
  title TEXT, description TEXT, category TEXT, location TEXT, latitude NUMERIC, longitude NUMERIC,
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT, image TEXT,
  created_at TIMESTAMPTZ, bid_count BIGINT, accepted_bid_id UUID,
  action_required_count BIGINT, has_new_bid BOOLEAN, has_my_review BOOLEAN,
  hired_worker_id UUID, hired_worker_name TEXT, hired_worker_phone TEXT,
  translations JSONB, my_bid_last_negotiation_by TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, p.name as poster_name, p.profile_photo as poster_photo, p.rating as poster_rating,
    j.title, j.description, j.category, j.location, j.latitude, j.longitude,
    j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.image,
    j.created_at, (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count, j.accepted_bid_id,
    (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id AND UPPER(b.status::TEXT) = 'PENDING' AND (b.negotiation_history IS NULL OR jsonb_array_length(b.negotiation_history) = 0 OR (b.negotiation_history -> -1 ->> 'by') IS DISTINCT FROM 'POSTER')) as action_required_count,
    EXISTS (SELECT 1 FROM bids b2 WHERE b2.job_id = j.id AND UPPER(b2.status::TEXT) = 'PENDING' AND b2.created_at > (NOW() - INTERVAL '24 hours')) as has_new_bid,
    EXISTS (SELECT 1 FROM reviews r WHERE r.job_id = j.id AND r.reviewer_id = p_user_id) as has_my_review,
    j.hired_worker_id, worker.name as hired_worker_name, worker.phone as hired_worker_phone,
    COALESCE(j.translations, '{}'::jsonb) as translations, NULL::TEXT as my_bid_last_negotiation_by 
  FROM jobs j
  JOIN profiles p ON p.id = j.poster_id
  LEFT JOIN profiles worker ON worker.id = j.hired_worker_id
  LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
  WHERE j.poster_id = p_user_id AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
  ORDER BY j.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;


-- ============================================
-- 3. GET JOB BIDS (Ambiguity Fix)
-- Source: FIX_GET_JOB_BIDS_AMBIGUITY.sql
-- ============================================

CREATE OR REPLACE FUNCTION get_job_bids(p_job_id UUID)
RETURNS TABLE (
    id UUID, job_id UUID, worker_id UUID, worker_name TEXT, worker_phone TEXT, worker_rating NUMERIC,
    worker_location TEXT, worker_latitude NUMERIC, worker_longitude NUMERIC, worker_photo TEXT,
    amount INTEGER, message TEXT, status TEXT, negotiation_history JSONB, created_at TIMESTAMPTZ, poster_id UUID
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_target_poster_id UUID;
    v_user_has_bid BOOLEAN;
BEGIN
    SELECT j.poster_id INTO v_target_poster_id FROM jobs j WHERE j.id = p_job_id;
    SELECT EXISTS(SELECT 1 FROM bids b_check WHERE b_check.job_id = p_job_id AND b_check.worker_id = auth.uid()) INTO v_user_has_bid;
    
    IF v_target_poster_id != auth.uid() AND NOT v_user_has_bid THEN
        RAISE EXCEPTION 'Access Denied: You must be the job poster or have a bid to view bids';
    END IF;

    RETURN QUERY 
    SELECT 
        b.id, b.job_id, b.worker_id, COALESCE(p.name, 'Unknown Worker'), p.phone, p.rating, p.location, p.latitude, p.longitude, p.profile_photo,
        b.amount, b.message, b.status::TEXT, b.negotiation_history, b.created_at, v_target_poster_id
    FROM bids b
    LEFT JOIN profiles p ON b.worker_id = p.id
    WHERE b.job_id = p_job_id
    ORDER BY b.created_at DESC;
END;
$$;


-- ============================================
-- 4. ACTION: PLACE BID (With Negotiation Init & Denormalization)
-- Source: 45_FIX_NEGOTIATION_VISIBILITY.sql
-- ============================================

CREATE OR REPLACE FUNCTION action_place_bid(p_job_id UUID, p_amount INTEGER, p_message TEXT DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_job_status TEXT; v_poster_id UUID; v_job_title TEXT; v_new_bid_id UUID;
    v_worker_id UUID := auth.uid();
    v_worker_name TEXT; v_worker_phone TEXT; v_worker_rating NUMERIC; v_worker_location TEXT;
    v_current_balance INTEGER; v_bid_cost INTEGER := 1;
BEGIN
    IF p_amount <= 0 THEN RETURN json_build_object('success', false, 'error', 'Bid amount must be positive'); END IF;
    SELECT status, poster_id, title INTO v_job_status, v_poster_id, v_job_title FROM jobs WHERE id = p_job_id;
    
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job is not open'); END IF;
    IF v_poster_id = v_worker_id THEN RETURN json_build_object('success', false, 'error', 'Cannot bid on own job'); END IF;
    IF EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id AND worker_id = v_worker_id) THEN RETURN json_build_object('success', false, 'error', 'Already bid on this job'); END IF;

    SELECT name, phone, rating, location INTO v_worker_name, v_worker_phone, v_worker_rating, v_worker_location FROM profiles WHERE id = v_worker_id;
    SELECT balance INTO v_current_balance FROM wallets WHERE user_id = v_worker_id FOR UPDATE;
    
    IF v_current_balance IS NULL THEN INSERT INTO wallets (user_id, balance) VALUES (v_worker_id, 0) RETURNING balance INTO v_current_balance; END IF;
    IF v_current_balance < v_bid_cost THEN RETURN json_build_object('success', false, 'error', 'Insufficient coins'); END IF;

    UPDATE wallets SET balance = balance - v_bid_cost, updated_at = NOW() WHERE user_id = v_worker_id;
    INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, type, description) VALUES (v_worker_id, -v_bid_cost, 'BID_FEE', 'BID_FEE', 'Bid on Job: ' || v_job_title);

    INSERT INTO bids (job_id, worker_id, amount, message, status, worker_name, worker_phone, worker_rating, worker_location, negotiation_history)
    VALUES (p_job_id, v_worker_id, p_amount, p_message, 'PENDING', v_worker_name, v_worker_phone, v_worker_rating, v_worker_location, 
            jsonb_build_array(jsonb_build_object('amount', p_amount, 'by', 'WORKER', 'at', extract(epoch from now()) * 1000, 'message', p_message)))
    RETURNING id INTO v_new_bid_id;

    INSERT INTO notifications (user_id, title, message, type, related_job_id, created_at)
    VALUES (v_poster_id, 'New Bid Received', 'Someone bid ₹' || p_amount || ' on ' || v_job_title, 'INFO', p_job_id, NOW());

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id, 'coins_remaining', v_current_balance - v_bid_cost);
END;
$$;


-- ============================================
-- 5. ACTION: COUNTER BID
-- Source: 45_FIX_NEGOTIATION_VISIBILITY.sql
-- ============================================

CREATE OR REPLACE FUNCTION action_counter_bid(p_bid_id UUID, p_amount NUMERIC, p_message TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_bid RECORD; v_job RECORD; v_user_role TEXT; v_negotiation_entry JSONB;
BEGIN
    IF p_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive'); END IF;
    SELECT * INTO v_bid FROM bids WHERE id = p_bid_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found'); END IF;
    SELECT * INTO v_job FROM jobs WHERE id = v_bid.job_id;
    IF v_job.status != 'OPEN' THEN RETURN jsonb_build_object('success', false, 'error', 'Job no longer open'); END IF;

    IF auth.uid() = v_bid.worker_id THEN v_user_role := 'WORKER';
    ELSIF auth.uid() = v_job.poster_id THEN v_user_role := 'POSTER';
    ELSE RETURN jsonb_build_object('success', false, 'error', 'Unauthorized'); END IF;

    v_negotiation_entry := jsonb_build_object('by', v_user_role, 'amount', p_amount, 'message', p_message, 'at', extract(epoch from now()) * 1000);

    UPDATE bids SET amount = p_amount, message = p_message, negotiation_history = COALESCE(negotiation_history, '[]'::jsonb) || v_negotiation_entry, status = 'PENDING', updated_at = now()
    WHERE id = p_bid_id;

    INSERT INTO notifications (user_id, title, message, type, related_job_id, created_at)
    VALUES (CASE WHEN v_user_role = 'WORKER' THEN v_job.poster_id ELSE v_bid.worker_id END, 'New Counter Offer', 
            CASE WHEN v_user_role = 'WORKER' THEN 'Worker' ELSE 'Employer' END || ' sent a counter offer of ₹' || p_amount || ' for ' || v_job.title, 'INFO', v_job.id, now());

    RETURN jsonb_build_object('success', true);
END;
$$;


-- ============================================
-- 6. ACTION: REJECT BID
-- Source: DEPLOY_FINAL_STABILITY_FIXES.sql
-- ============================================

CREATE OR REPLACE FUNCTION action_reject_bid(p_bid_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_bid RECORD; v_job RECORD;
BEGIN
    SELECT * INTO v_bid FROM bids WHERE id = p_bid_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found'); END IF;
    SELECT * INTO v_job FROM jobs WHERE id = v_bid.job_id;
    IF auth.uid() != v_job.poster_id THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthorized'); END IF;

    UPDATE bids SET status = 'REJECTED', updated_at = now() WHERE id = p_bid_id;

    INSERT INTO notifications (user_id, title, message, type, related_job_id, created_at)
    VALUES (v_bid.worker_id, 'Bid Update', 'The employer chose a different worker for "' || v_job.title || '". Don''t give up!', 'INFO', v_job.id, now());

    RETURN jsonb_build_object('success', true);
END;
$$;


-- ============================================
-- 7. ACCEPT BID (With accepted_at and Ghost Bid Check)
-- Source: 44_FIX_BID_SCHEMA.sql
-- ============================================

CREATE OR REPLACE FUNCTION accept_bid(p_job_id UUID, p_bid_id UUID, p_poster_id UUID, p_worker_id UUID, p_amount INTEGER, p_poster_fee INTEGER DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_job_status TEXT; v_bid_status TEXT; v_bid_exists BOOLEAN;
BEGIN
  SELECT status INTO v_job_status FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF v_job_status != 'OPEN' THEN RAISE EXCEPTION 'Job is not open for bidding (current status: %)', v_job_status; END IF;

  SELECT status, TRUE INTO v_bid_status, v_bid_exists FROM bids WHERE id = p_bid_id;
  IF v_bid_exists IS NULL THEN RAISE EXCEPTION 'Bid not found (User may have withdrawn)'; END IF;
  IF v_bid_status = 'REJECTED' THEN RAISE EXCEPTION 'Cannot accept a withdrawn/rejected bid.'; END IF;

  UPDATE jobs SET status = 'IN_PROGRESS', accepted_bid_id = p_bid_id, updated_at = NOW() WHERE id = p_job_id;
  UPDATE bids SET status = 'ACCEPTED', accepted_at = NOW(), updated_at = NOW() WHERE id = p_bid_id;
  UPDATE bids SET status = 'REJECTED', updated_at = NOW() WHERE job_id = p_job_id AND id != p_bid_id AND status = 'PENDING';

  RETURN jsonb_build_object('success', true, 'message', 'Bid accepted successfully');
END;
$$;
