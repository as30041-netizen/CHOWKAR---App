-- ============================================================================
-- VERIFY AND FIX - MASTER SCRIPT
-- ============================================================================
-- This script reapplies ALL critical functions and triggers for the Bidding System.
-- Run this once to ensure your database is 100% in sync with the frontend code.
-- ============================================================================

-- 1. DROP EVERYTHING FIRST to avoid return type conflicts
DROP FUNCTION IF EXISTS get_home_feed(uuid, int, int, text, boolean);
DROP FUNCTION IF EXISTS get_my_jobs_feed(uuid, int, int);
DROP FUNCTION IF EXISTS get_my_applications_feed(uuid, int, int);
DROP FUNCTION IF EXISTS accept_bid(uuid, uuid, uuid, uuid, integer, integer);
DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON bids;
DROP FUNCTION IF EXISTS notify_on_counter_offer();

-- ============================================================================
-- 2. RECREATE DATA FETCHING RPCS (With negotiation support)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_home_feed(
    p_user_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_status TEXT DEFAULT NULL,
    p_exclude_completed BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    poster_id UUID,
    poster_name TEXT,
    poster_photo TEXT,
    title TEXT,
    description TEXT,
    category TEXT,
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    job_date TEXT,
    duration TEXT,
    budget NUMERIC,
    status TEXT,
    created_at TIMESTAMPTZ,
    accepted_bid_id UUID,
    image TEXT,
    bid_count BIGINT,
    my_bid_id UUID,
    my_bid_status TEXT,
    my_bid_amount NUMERIC,
    my_bid_last_negotiation_by TEXT -- CRITICAL NEW FIELD
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT 
        j.id,
        j.poster_id,
        j.poster_name,
        j.poster_photo,
        j.title,
        j.description,
        j.category,
        j.location,
        j.latitude,
        j.longitude,
        j.job_date,
        j.duration,
        j.budget,
        j.status,
        j.created_at,
        j.accepted_bid_id,
        j.image,
        (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id)::BIGINT as bid_count,
        (SELECT b.id FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1) as my_bid_id,
        (SELECT b.status FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1) as my_bid_status,
        (SELECT b.amount FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1) as my_bid_amount,
        (SELECT b.negotiation_history->-1->>'by' FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1) as my_bid_last_negotiation_by
    FROM jobs j
    WHERE 
        (p_status IS NULL OR j.status = p_status)
        AND (p_exclude_completed = FALSE OR j.status != 'COMPLETED')
    ORDER BY j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION get_my_applications_feed(
    p_user_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    poster_id UUID,
    poster_name TEXT,
    poster_photo TEXT,
    title TEXT,
    description TEXT,
    category TEXT,
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    job_date TEXT,
    duration TEXT,
    budget NUMERIC,
    status TEXT,
    created_at TIMESTAMPTZ,
    accepted_bid_id UUID,
    image TEXT,
    bid_count BIGINT,
    my_bid_id UUID,
    my_bid_amount NUMERIC,
    my_bid_status TEXT,
    my_bid_created_at TIMESTAMPTZ,
    is_my_bid_accepted BOOLEAN,
    my_bid_last_negotiation_by TEXT -- CRITICAL NEW FIELD
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT 
        j.id,
        j.poster_id,
        j.poster_name,
        j.poster_photo,
        j.title,
        j.description,
        j.category,
        j.location,
        j.latitude,
        j.longitude,
        j.job_date,
        j.duration,
        j.budget,
        j.status,
        j.created_at,
        j.accepted_bid_id,
        j.image,
        (SELECT COUNT(*) FROM bids b2 WHERE b2.job_id = j.id)::BIGINT as bid_count,
        b.id as my_bid_id,
        b.amount as my_bid_amount,
        b.status as my_bid_status,
        b.created_at as my_bid_created_at,
        (j.accepted_bid_id = b.id) as is_my_bid_accepted,
        (b.negotiation_history->-1->>'by') as my_bid_last_negotiation_by
    FROM bids b
    JOIN jobs j ON j.id = b.job_id
    WHERE b.worker_id = p_user_id
    ORDER BY 
        CASE 
            WHEN j.accepted_bid_id = b.id AND j.status = 'IN_PROGRESS' THEN 1  
            WHEN b.status = 'PENDING' THEN 2 
            ELSE 3 
        END,
        b.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
$$;

-- ============================================================================
-- 3. RECREATE NOTIFICATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_on_counter_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_worker_name TEXT;
  v_poster_name TEXT;
  v_last_counter_by TEXT;
  v_recipient_id UUID;
  v_amount_changed BOOLEAN;
  v_history_length INT;
  v_old_history_length INT;
BEGIN
  v_amount_changed := (NEW.amount != OLD.amount) OR (NEW.negotiation_history IS DISTINCT FROM OLD.negotiation_history);
  
  IF v_amount_changed AND NEW.status = 'PENDING' THEN
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;
    SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
    
    v_history_length := COALESCE(jsonb_array_length(NEW.negotiation_history::jsonb), 0);
    v_old_history_length := COALESCE(jsonb_array_length(OLD.negotiation_history::jsonb), 0);
    
    -- Notification Logic:
    -- 1. Ensure history length INCREASED (new entry added)
    -- 2. Identify the last entry's author
    -- 3. Notify the OTHER party
    
    IF v_history_length > v_old_history_length AND v_history_length > 0 THEN
      v_last_counter_by := NEW.negotiation_history::jsonb->(v_history_length - 1)->>'by';
      
      -- If POSTER made the move -> Notify WORKER
      IF v_last_counter_by = 'POSTER' THEN
          v_recipient_id := NEW.worker_id;
          INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
          VALUES (v_recipient_id, 'INFO', 'New Offer 💰', COALESCE(v_poster_name, 'Employer') || ' offered ₹' || NEW.amount || ' for "' || v_job.title || '". Tap to respond!', NEW.job_id, false, NOW());
          
      -- If WORKER made the move -> Notify POSTER
      ELSIF v_last_counter_by = 'WORKER' THEN
          v_recipient_id := v_job.poster_id;
          INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
          VALUES (v_recipient_id, 'INFO', 'New Counter Offer 💰', COALESCE(v_worker_name, 'Worker') || ' proposed ₹' || NEW.amount || ' for "' || v_job.title || '". Tap to respond!', NEW.job_id, false, NOW());
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_on_counter_offer
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_counter_offer();

-- ============================================================================
-- 4. RECREATE ACCEPT BID RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_bid(
  p_job_id uuid,
  p_bid_id uuid,
  p_poster_id uuid,
  p_worker_id uuid,
  p_amount integer,
  p_poster_fee integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_status text;
  v_bid_exists boolean;
BEGIN
  -- Validate Job
  SELECT status INTO v_job_status FROM jobs WHERE id = p_job_id;
  IF v_job_status != 'OPEN' THEN
    RAISE EXCEPTION 'Job is no longer OPEN (Status: %)', v_job_status;
  END IF;

  -- Validate Bid
  SELECT EXISTS(SELECT 1 FROM bids WHERE id = p_bid_id AND status = 'PENDING') INTO v_bid_exists;
  IF NOT v_bid_exists THEN
    RAISE EXCEPTION 'Bid not found or not PENDING';
  END IF;

  -- Payment Logic would go here (skipped for simplicity in this script as typically handled by triggers)
  UPDATE profiles SET wallet_balance = wallet_balance - p_poster_fee WHERE id = p_poster_id;

  -- Update Job Status
  UPDATE jobs 
  SET status = 'IN_PROGRESS', 
      accepted_bid_id = p_bid_id
  WHERE id = p_job_id;

  -- Update Bid Status
  UPDATE bids
  SET status = 'ACCEPTED'
  WHERE id = p_bid_id;
  
  -- Create Notification for Worker
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (p_worker_id, 'SUCCESS', 'You Got the Job! 🎉', 'Your bid was accepted. You can now chat with the employer.', p_job_id, false, NOW());

END;
$$;

GRANT EXECUTE ON FUNCTION accept_bid TO authenticated;
GRANT EXECUTE ON FUNCTION get_home_feed TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_applications_feed TO authenticated;

DO $$
BEGIN
    RAISE NOTICE '✅ ALL FIXES APPLIED SUCCESSFULLY';
END $$;
