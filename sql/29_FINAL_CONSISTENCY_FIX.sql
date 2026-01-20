-- ============================================================================
-- FINAL DATA CONSISTENCY FIX
-- Standardizes all Job feeds and RPCs to return identical fields/mapping.
-- ============================================================================

BEGIN;

-- 1. DROP ALL TO PREVENT CONFLICTS (Explicit signatures required for type changes)
DROP FUNCTION IF EXISTS get_dashboard_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS get_home_feed(UUID, INTEGER, INTEGER, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_my_jobs_feed(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_my_applications_feed(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_job_details(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_inbox_summaries(UUID) CASCADE;

-- 1.5 MASTER DASHBOARD STATS
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_poster_active INTEGER;
    v_poster_history INTEGER;
    v_worker_active INTEGER;
    v_worker_history INTEGER;
    v_discover_active INTEGER;
BEGIN
    -- DISCOVER ACTIVE: Jobs with status OPEN where I haven't bid yet (and not hidden)
    SELECT COUNT(j.id) INTO v_discover_active
    FROM jobs j
    LEFT JOIN bids b ON b.job_id = j.id AND b.worker_id = p_user_id
    LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
    WHERE j.status = 'OPEN'
      AND j.poster_id != p_user_id
      AND b.id IS NULL
      AND (v.is_hidden IS NULL OR v.is_hidden = FALSE);

    -- POSTER ACTIVE: My jobs that are OPEN or IN_PROGRESS (not hidden)
    SELECT COUNT(*) INTO v_poster_active
    FROM jobs j
    LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
    WHERE j.poster_id = p_user_id
      AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
      AND j.status IN ('OPEN', 'IN_PROGRESS');

    -- POSTER HISTORY: My jobs that are COMPLETED or CANCELLED (not hidden)
    SELECT COUNT(*) INTO v_poster_history
    FROM jobs j
    LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
    WHERE j.poster_id = p_user_id
      AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
      AND j.status IN ('COMPLETED', 'CANCELLED');

    -- WORKER ACTIVE: Bids I've placed that are still "active" (not hidden)
    SELECT COUNT(*) INTO v_worker_active
    FROM bids b
    JOIN jobs j ON b.job_id = j.id
    LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
    WHERE b.worker_id = p_user_id
      AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
      AND (
          (j.status = 'OPEN' AND b.status IN ('PENDING', 'ACCEPTED'))
          OR 
          (j.status = 'IN_PROGRESS' AND j.accepted_bid_id = b.id)
      );

    -- WORKER HISTORY: Bids/Jobs that are finished (not hidden)
    SELECT COUNT(*) INTO v_worker_history
    FROM bids b
    JOIN jobs j ON b.job_id = j.id
    LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
    WHERE b.worker_id = p_user_id
      AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
      AND (
          b.status = 'REJECTED'
          OR j.status IN ('COMPLETED', 'CANCELLED')
          OR (j.status != 'OPEN' AND (j.accepted_bid_id IS NULL OR j.accepted_bid_id != b.id))
      );

    RETURN jsonb_build_object(
        'poster_active', v_poster_active,
        'poster_history', v_poster_history,
        'worker_active', v_worker_active,
        'worker_history', v_worker_history,
        'discover_active', v_discover_active
    );
END;
$$;

-- 2. GET_JOB_DETAILS (Individual Job Fetch)
CREATE OR REPLACE FUNCTION get_job_details(p_job_id UUID, p_user_id UUID)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_phone TEXT, poster_photo TEXT, poster_rating NUMERIC,
  title TEXT, description TEXT, category TEXT, location TEXT, latitude NUMERIC, longitude NUMERIC,
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT,
  accepted_bid_id UUID, image TEXT, created_at TIMESTAMPTZ, bid_count BIGINT,
  my_bid_id UUID, my_bid_status TEXT, my_bid_amount INTEGER, my_bid_last_negotiation_by TEXT,
  has_agreement BOOLEAN, action_required_count BIGINT, has_my_review BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, p.name as poster_name, p.phone as poster_phone, p.profile_photo as poster_photo, p.rating as poster_rating,
    j.title, j.description, j.category, j.location, j.latitude, j.longitude,
    j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.accepted_bid_id, j.image, j.created_at,
    (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
    b.id as my_bid_id, UPPER(b.status::TEXT) as my_bid_status, b.amount as my_bid_amount,
    (b.negotiation_history->-1->>'by') as my_bid_last_negotiation_by,
    EXISTS (SELECT 1 FROM bids b2 WHERE b2.job_id = j.id AND (b2.negotiation_history->-1->>'agreed')::boolean = true) as has_agreement,
    (SELECT COUNT(*) FROM bids b3 WHERE b3.job_id = j.id AND b3.status = 'PENDING') as action_required_count,
    EXISTS (SELECT 1 FROM reviews r WHERE r.job_id = j.id AND r.reviewer_id = p_user_id) as has_my_review
  FROM jobs j
  JOIN profiles p ON p.id = j.poster_id
  LEFT JOIN bids b ON b.job_id = j.id AND b.worker_id = p_user_id
  WHERE j.id = p_job_id;
END;
$$;

-- 3. GET_HOME_FEED (Discovery)
CREATE OR REPLACE FUNCTION get_home_feed(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0, p_category TEXT DEFAULT NULL, p_search_query TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT, poster_rating NUMERIC,
  title TEXT, description TEXT, category TEXT, location TEXT, latitude NUMERIC, longitude NUMERIC,
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT,
  created_at TIMESTAMPTZ, bid_count BIGINT, my_bid_id UUID
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, p.name as poster_name, p.profile_photo as poster_photo, p.rating as poster_rating,
    j.title, j.description, j.category, j.location, j.latitude, j.longitude,
    j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.created_at,
    (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
    b.id as my_bid_id
  FROM jobs j
  JOIN profiles p ON p.id = j.poster_id
  LEFT JOIN bids b ON b.job_id = j.id AND b.worker_id = p_user_id
  LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
  WHERE j.status = 'OPEN' 
    AND j.poster_id != p_user_id
    AND b.id IS NULL -- Exclude jobs already bid on for "Discover"
    AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
    AND (p_category IS NULL OR j.category = p_category)
    AND (p_search_query IS NULL OR (j.title || j.description) ILIKE '%' || p_search_query || '%')
  ORDER BY j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 4. GET_MY_JOBS_FEED (Poster Dashboard)
CREATE OR REPLACE FUNCTION get_my_jobs_feed(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT, poster_rating NUMERIC,
  title TEXT, description TEXT, category TEXT, location TEXT, latitude NUMERIC, longitude NUMERIC,
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT,
  created_at TIMESTAMPTZ, bid_count BIGINT, accepted_bid_id UUID,
  action_required_count BIGINT, has_new_bid BOOLEAN, has_my_review BOOLEAN
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
    EXISTS (SELECT 1 FROM reviews r WHERE r.job_id = j.id AND r.reviewer_id = p_user_id) as has_my_review
  FROM jobs j
  JOIN profiles p ON p.id = j.poster_id
  LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
  WHERE j.poster_id = p_user_id
    AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
  ORDER BY j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 5. GET_MY_APPLICATIONS_FEED (Worker Dashboard)
CREATE OR REPLACE FUNCTION get_my_applications_feed(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT, poster_rating NUMERIC,
  title TEXT, description TEXT, category TEXT, location TEXT, latitude NUMERIC, longitude NUMERIC,
  job_date TIMESTAMPTZ, duration TEXT, budget INTEGER, status TEXT,
  created_at TIMESTAMPTZ, bid_count BIGINT, 
  my_bid_id UUID, my_bid_status TEXT, my_bid_amount INTEGER, my_bid_last_negotiation_by TEXT,
  accepted_bid_id UUID, has_my_review BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.poster_id, p.name as poster_name, p.profile_photo as poster_photo, p.rating as poster_rating,
    j.title, j.description, j.category, j.location, j.latitude, j.longitude,
    j.job_date::TIMESTAMPTZ, j.duration, j.budget, UPPER(j.status::TEXT) as status, j.created_at,
    (SELECT COUNT(*) FROM bids WHERE job_id = j.id) as bid_count,
    b.id as my_bid_id, UPPER(b.status::TEXT) as my_bid_status, b.amount as my_bid_amount,
    (b.negotiation_history->-1->>'by') as my_bid_last_negotiation_by,
    j.accepted_bid_id,
    EXISTS (SELECT 1 FROM reviews r WHERE r.job_id = j.id AND r.reviewer_id = p_user_id) as has_my_review
  FROM bids b
  JOIN jobs j ON j.id = b.job_id
  JOIN profiles p ON p.id = j.poster_id
  LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
  WHERE b.worker_id = p_user_id
    AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
  ORDER BY b.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMIT;

-- 6. GET_INBOX_SUMMARIES (Chat Inbox)
CREATE OR REPLACE FUNCTION get_inbox_summaries(p_user_id UUID)
RETURNS TABLE (
  job_id UUID, job_title TEXT, job_status TEXT, poster_id UUID, accepted_bid_id UUID,
  counterpart_id UUID, counterpart_name TEXT, counterpart_photo TEXT, counterpart_rating NUMERIC,
  last_message_text TEXT, last_message_time TIMESTAMPTZ, last_message_sender_id UUID, last_message_is_read BOOLEAN,
  unread_count BIGINT, is_archived BOOLEAN, is_deleted BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH thread_summaries AS (
    SELECT m.job_id, CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END AS other_user_id, MAX(m.created_at) as last_time
    FROM chat_messages m
    WHERE m.sender_id = p_user_id OR m.receiver_id = p_user_id
    GROUP BY m.job_id, other_user_id
  ),
  message_details AS (
    SELECT DISTINCT ON (ts.job_id, ts.other_user_id) ts.job_id, ts.other_user_id, ts.last_time, m.text as last_text, m.sender_id as last_sender, m.read as last_read
    FROM thread_summaries ts
    JOIN chat_messages m ON m.job_id = ts.job_id AND m.created_at = ts.last_time
      AND ((m.sender_id = p_user_id AND m.receiver_id = ts.other_user_id) OR (m.sender_id = ts.other_user_id AND m.receiver_id = p_user_id))
    ORDER BY ts.job_id, ts.other_user_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT m.job_id, m.sender_id as other_user_id, COUNT(*) as unread FROM chat_messages m
    WHERE m.receiver_id = p_user_id AND m.read = FALSE GROUP BY m.job_id, m.sender_id
  )
  SELECT 
    j.id as job_id, j.title as job_title, j.status::TEXT as job_status, j.poster_id, j.accepted_bid_id,
    md.other_user_id as counterpart_id, p.name as counterpart_name, p.profile_photo as counterpart_photo, p.rating as counterpart_rating,
    md.last_text as last_message_text, md.last_time as last_message_time, md.last_sender as last_message_sender_id, md.last_read as last_message_is_read,
    COALESCE(uc.unread, 0) as unread_count,
    COALESCE(cs.is_archived, FALSE) as is_archived,
    COALESCE(cs.is_deleted, FALSE) as is_deleted
  FROM message_details md
  JOIN jobs j ON j.id = md.job_id
  JOIN profiles p ON p.id = md.other_user_id
  LEFT JOIN unread_counts uc ON uc.job_id = md.job_id AND uc.other_user_id = md.other_user_id
  LEFT JOIN chat_states cs ON cs.job_id = md.job_id AND cs.user_id = p_user_id
  ORDER BY md.last_time DESC;
END;
$$;

COMMIT;
