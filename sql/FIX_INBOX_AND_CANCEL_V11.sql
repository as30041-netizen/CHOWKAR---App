-- ============================================
-- FIX INBOX AND CANCELLATION V11 (FINAL ROBUST VERSION)
-- 1. Fix get_inbox_summaries: Correct cp_id mapping even for old messages
-- 2. Fix cancel_job_with_refund: Independent of wallet system & more permissive
-- 3. Ensure no empty inboxes for posters in handshake
-- ============================================

-- MANUALLY DROP TO CHANGE RETURN TYPES
DROP FUNCTION IF EXISTS cancel_job_with_refund(UUID, TEXT);
DROP FUNCTION IF EXISTS get_inbox_summaries(UUID);

-- 1. Fix Cancellation Logic (Robust and Wallet-system independent)
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
  v_accepted_worker_id UUID;
  v_title TEXT;
BEGIN
  -- 1. Check permission and existence
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id AND poster_id = auth.uid();
  
  IF NOT FOUND THEN
    -- Check if it exists at all to give better error
    IF EXISTS (SELECT 1 FROM jobs WHERE id = p_job_id) THEN
        RAISE EXCEPTION 'Not authorized to cancel this job';
    ELSE
        RAISE EXCEPTION 'Job not found';
    END IF;
  END IF;

  IF v_job.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'Cannot cancel a completed job';
  END IF;

  -- 2. Identify the worker to notify (if any)
  IF v_job.accepted_bid_id IS NOT NULL THEN
    SELECT worker_id INTO v_accepted_worker_id FROM bids WHERE id = v_job.accepted_bid_id;
  END IF;

  -- 3. Update job status to COMPLETED (used as cancelled in this schema)
  UPDATE jobs
  SET 
    status = 'COMPLETED',
    updated_at = NOW()
  WHERE id = p_job_id;

  -- 4. Notify affected parties
  -- Notify the hired worker
  IF v_accepted_worker_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      v_accepted_worker_id,
      'WARNING',
      'Job Cancelled ⚠️',
      'The job "' || v_job.title || '" has been cancelled by the employer.',
      p_job_id,
      false,
      NOW()
    );
    
    -- Update bid status
    UPDATE bids SET status = 'REJECTED', updated_at = NOW() WHERE id = v_job.accepted_bid_id;
  END IF;

  -- Notify other bidders
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  SELECT 
    worker_id,
    'INFO',
    'Job No Longer Available',
    'The job "' || v_job.title || '" has been cancelled. Look for other opportunities!',
    p_job_id,
    false,
    NOW()
  FROM bids
  WHERE job_id = p_job_id 
    AND status = 'PENDING'
    AND (v_accepted_worker_id IS NULL OR worker_id != v_accepted_worker_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Job cancelled successfully',
    'refund_amount', 0,
    'penalty', false
  );
END;
$$;

-- 2. Fix Inbox Summaries (Correct Counterpart detection for Posters)
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
  WITH my_relevant_jobs AS (
    -- Get jobs I am involved in
    SELECT DISTINCT j.id as r_id
    FROM jobs j
    LEFT JOIN bids b ON b.job_id = j.id
    WHERE j.poster_id = p_user_id 
       OR b.worker_id = p_user_id
  ),
  active_conversations AS (
    -- Filter to jobs with activity
    SELECT 
      j.id, j.title, j.status, j.poster_id, j.created_at as job_created_at,
      (SELECT worker_id FROM bids WHERE id = j.accepted_bid_id) as accepted_worker_uid,
      (SELECT worker_id FROM bids WHERE job_id = j.id AND negotiation_history @> '[{"agreed": true}]' LIMIT 1) as agreed_worker_uid
    FROM jobs j
    JOIN my_relevant_jobs rj ON rj.r_id = j.id
    WHERE (j.status IN ('IN_PROGRESS', 'COMPLETED'))
       OR EXISTS (SELECT 1 FROM chat_messages m WHERE m.job_id = j.id)
  ),
  with_counterparty AS (
    -- Robustly identify who the other person is
    SELECT 
      ac.*,
      CASE 
        WHEN ac.poster_id = p_user_id THEN (
            -- I am poster, find the worker to show
            COALESCE(
              ac.accepted_worker_uid,
              ac.agreed_worker_uid,
              -- If no hire/agreement, look at who sent us messages
              (SELECT sender_id FROM chat_messages m WHERE m.job_id = ac.id AND m.sender_id != p_user_id LIMIT 1),
              -- If we sent messages but receiver_id is missing (old data), check ANY bidder involved in this job
              (SELECT worker_id FROM bids b WHERE b.job_id = ac.id LIMIT 1)
            )
        )
        ELSE ac.poster_id -- I am worker, other is poster
      END as cp_id
    FROM active_conversations ac
  )
  SELECT 
    wc.id,
    wc.title,
    wc.status::TEXT,
    wc.poster_id,
    wc.accepted_worker_uid,
    wc.cp_id,
    COALESCE(p.name, 'Chowkar User'),
    p.profile_photo,
    COALESCE(ms.text, 'Chat started! 👋'),
    COALESCE(ms.created_at, wc.job_created_at),
    ms.sender_id,
    ms.read,
    (SELECT COUNT(*) FROM notifications n WHERE n.user_id = p_user_id AND n.related_job_id = wc.id AND n.read = false)::BIGINT,
    COALESCE(cs.is_archived, false),
    COALESCE(cs.is_deleted, false)
  FROM with_counterparty wc
  LEFT JOIN LATERAL (
      SELECT m.text, m.created_at, m.sender_id, m.read 
      FROM chat_messages m 
      WHERE m.job_id = wc.id 
      ORDER BY m.created_at DESC LIMIT 1
  ) ms ON TRUE
  LEFT JOIN profiles p ON p.id = wc.cp_id
  LEFT JOIN chat_states cs ON cs.job_id = wc.id AND cs.user_id = p_user_id
  WHERE wc.cp_id IS NOT NULL 
    AND COALESCE(cs.is_deleted, false) = false
  ORDER BY COALESCE(ms.created_at, wc.job_created_at) DESC;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ Inbox and Cancellation V11 (Final) deployed successfully';
END $$;
