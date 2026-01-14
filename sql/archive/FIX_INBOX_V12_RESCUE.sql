-- ============================================
-- FIX INBOX AND CANCELLATION V12 (RESCUE MISSION)
-- 1. Ultra-permissive counterpart detection
-- 2. Fixed cross-role visibility for cancelled jobs
-- 3. Robust message last-sender attribution
-- ============================================

-- DROP TO CLEAN UP
DROP FUNCTION IF EXISTS cancel_job_with_refund(UUID, TEXT);
DROP FUNCTION IF EXISTS get_inbox_summaries(UUID);

-- 1. Fix Cancellation (Simpler, more robust)
CREATE OR REPLACE FUNCTION cancel_job_with_refund(
  p_job_id UUID,
  p_reason TEXT DEFAULT 'Cancelled by poster'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_worker_id UUID;
BEGIN
  -- Validate poster ownership
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id AND poster_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or unauthorized';
  END IF;

  -- Get accepted worker before we change status
  IF v_job.accepted_bid_id IS NOT NULL THEN
    SELECT worker_id INTO v_worker_id FROM bids WHERE id = v_job.accepted_bid_id;
  END IF;

  -- Change status to COMPLETED (Cancelled state)
  UPDATE jobs SET status = 'COMPLETED', updated_at = NOW() WHERE id = p_job_id;

  -- Notify the hired worker if any
  IF v_worker_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (v_worker_id, 'WARNING', 'Job Cancelled ⚠️', 'Employer cancelled "' || v_job.title || '".', p_job_id, false, NOW());
    UPDATE bids SET status = 'REJECTED' WHERE id = v_job.accepted_bid_id;
  END IF;

  -- Notify all other bidders
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  SELECT worker_id, 'INFO', 'Job Closed', 'The job "' || v_job.title || '" is no longer available.', p_job_id, false, NOW()
  FROM bids WHERE job_id = p_job_id AND status = 'PENDING' AND (v_worker_id IS NULL OR worker_id != v_worker_id);

  RETURN jsonb_build_object('success', true, 'message', 'Job cancelled');
END;
$$;

-- 2. Fix Inbox (The "Search & Rescue" Edition)
CREATE OR REPLACE FUNCTION get_inbox_summaries(p_user_id UUID)
RETURNS TABLE (
  job_id UUID,
  job_title TEXT,
  job_status TEXT,
  poster_id UUID,
  accepted_bidder_id UUID,
  counterpart_id UUID,
  counterpart_name TEXT,
  counterpart_photo TEXT,
  last_message_text TEXT,
  last_message_time TIMESTAMPTZ,
  last_message_sender_id UUID,
  last_message_is_read BOOLEAN,
  unread_count BIGINT,
  is_archived BOOLEAN,
  is_deleted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH my_jobs AS (
    -- All jobs I'm involved in as poster or bidder
    SELECT DISTINCT j.id as r_id, j.poster_id
    FROM jobs j
    LEFT JOIN bids b ON b.job_id = j.id
    WHERE j.poster_id = p_user_id OR b.worker_id = p_user_id
  ),
  active_jobs AS (
    -- Filter to jobs that have actual chat history or are mid-hire
    -- We include COMPLETED/CANCELLED so they stay in history/archive
    SELECT 
      j.id, j.title, j.status, j.poster_id, j.created_at as job_created_at,
      (SELECT worker_id FROM bids WHERE id = j.accepted_bid_id) as hired_uid,
      (SELECT worker_id FROM bids WHERE job_id = j.id AND negotiation_history @> '[{"agreed": true}]' LIMIT 1) as agreed_uid
    FROM jobs j
    JOIN my_jobs mj ON mj.r_id = j.id
    WHERE EXISTS (SELECT 1 FROM chat_messages m WHERE m.job_id = j.id)
       OR j.status IN ('IN_PROGRESS', 'COMPLETED')
  ),
  with_final_counterparty AS (
    SELECT 
      aj.*,
      CASE 
        WHEN aj.poster_id = p_user_id THEN (
          -- I am Poster: Who am I talking to?
          COALESCE(
            aj.hired_uid,
            aj.agreed_uid,
            -- FALLBACK 1: The last person who messaged me in this job
            (SELECT sender_id FROM chat_messages m WHERE m.job_id = aj.id AND m.sender_id != p_user_id ORDER BY created_at DESC LIMIT 1),
            -- FALLBACK 2: The person I last messaged in this job (if I sent receiver_id)
            (SELECT receiver_id FROM chat_messages m WHERE m.job_id = aj.id AND m.sender_id = p_user_id AND m.receiver_id IS NOT NULL ORDER BY created_at DESC LIMIT 1),
            -- FALLBACK 3: Any bidder for this job
            (SELECT worker_id FROM bids b WHERE b.job_id = aj.id ORDER BY updated_at DESC LIMIT 1)
          )
        )
        ELSE aj.poster_id -- I am Worker: Counterparty is always the Poster
      END as cp_id
    FROM active_jobs aj
  )
  SELECT 
    wfc.id,
    wfc.title,
    wfc.status::TEXT,
    wfc.poster_id,
    wfc.hired_uid,
    wfc.cp_id,
    COALESCE(p.name, 'Chowkar User'),
    p.profile_photo,
    COALESCE(ms.text, 'Chat started! 👋'),
    COALESCE(ms.created_at, wfc.job_created_at),
    ms.sender_id,
    ms.read,
    (SELECT COUNT(*) FROM notifications n WHERE n.user_id = p_user_id AND n.related_job_id = wfc.id AND n.read = false)::BIGINT,
    COALESCE(cs.is_archived, false),
    COALESCE(cs.is_deleted, false)
  FROM with_final_counterparty wfc
  LEFT JOIN LATERAL (
      SELECT m.text, m.created_at, m.sender_id, m.read 
      FROM chat_messages m 
      WHERE m.job_id = wfc.id 
      ORDER BY m.created_at DESC LIMIT 1
  ) ms ON TRUE
  LEFT JOIN profiles p ON p.id = wfc.cp_id
  LEFT JOIN chat_states cs ON cs.job_id = wfc.id AND cs.user_id = p_user_id
  WHERE wfc.cp_id IS NOT NULL 
    AND COALESCE(cs.is_deleted, false) = false
  ORDER BY COALESCE(ms.created_at, wfc.job_created_at) DESC;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ Inbox Rescue V12 Deployed. Check your chats now!';
END $$;
