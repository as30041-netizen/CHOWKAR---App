-- ============================================
-- FIX INBOX V18 (CONVERSATION-CENTRIC RESCUE)
-- 1. Redesigned get_inbox_summaries to support multiple bidders per job
-- 2. Ultra-permissive visibility for accepted and handshake jobs
-- 3. Robust counterpart detection
-- ============================================

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
  WITH all_conversations AS (
    -- Group A: Any job I posted + any worker who bid on it
    SELECT j.id as r_job_id, b.worker_id as r_cp_id, 'POSTER' as r_role
    FROM jobs j
    JOIN bids b ON b.job_id = j.id
    WHERE j.poster_id = p_user_id

    UNION

    -- Group B: Any job I posted + anyone I have messaged (even without bid)
    SELECT DISTINCT m.job_id, m.receiver_id, 'POSTER'
    FROM chat_messages m
    JOIN jobs j ON j.id = m.job_id
    WHERE j.poster_id = p_user_id 
      AND m.receiver_id != p_user_id

    UNION

    -- Group C: Anyone who messaged me on my job
    SELECT DISTINCT m.job_id, m.sender_id, 'POSTER'
    FROM chat_messages m
    JOIN jobs j ON j.id = m.job_id
    WHERE j.poster_id = p_user_id 
      AND m.sender_id != p_user_id

    UNION

    -- Group D: Any job I bid on
    SELECT b.job_id, j.poster_id, 'WORKER'
    FROM bids b
    JOIN jobs j ON j.id = b.job_id
    WHERE b.worker_id = p_user_id

    UNION

    -- Group E: Any job I messaged on (as worker)
    SELECT DISTINCT m.job_id, j.poster_id, 'WORKER'
    FROM chat_messages m
    JOIN jobs j ON j.id = m.job_id
    WHERE m.sender_id = p_user_id 
      AND j.poster_id != p_user_id
  ),
  distinct_convos AS (
    SELECT DISTINCT r_job_id, r_cp_id FROM all_conversations
    WHERE r_cp_id IS NOT NULL
  ),
  convos_with_details AS (
    SELECT 
      dc.r_job_id,
      dc.r_cp_id,
      j.title,
      j.status,
      j.poster_id,
      j.created_at as job_created_at,
      (SELECT worker_id FROM bids WHERE id = j.accepted_bid_id) as hired_uid,
      -- Check if this specific worker is the hired one
      CASE WHEN (SELECT worker_id FROM bids WHERE id = j.accepted_bid_id) = dc.r_cp_id THEN j.accepted_bid_id ELSE NULL END as specific_accepted_bid_id
    FROM distinct_convos dc
    JOIN jobs j ON j.id = dc.r_job_id
    -- Filter out hidden jobs
    WHERE NOT EXISTS (
      SELECT 1 FROM user_job_visibility v 
      WHERE v.job_id = dc.r_job_id AND v.user_id = p_user_id AND v.is_hidden = TRUE
    )
  )
  SELECT 
    cwd.r_job_id,
    cwd.title,
    cwd.status::TEXT,
    cwd.poster_id,
    cwd.specific_accepted_bid_id, -- Return the bid ID only if it belongs to this counterpart
    cwd.r_cp_id,
    COALESCE(p.name, 'Chowkar User'),
    p.profile_photo,
    COALESCE(msg.text, 'Chat started! 👋'),
    COALESCE(msg.created_at, cwd.job_created_at),
    msg.sender_id,
    msg.read,
    (SELECT COUNT(*) FROM notifications n WHERE n.user_id = p_user_id AND n.related_job_id = cwd.r_job_id AND n.read = false)::BIGINT,
    COALESCE(cs.is_archived, false),
    COALESCE(cs.is_deleted, false)
  FROM convos_with_details cwd
  LEFT JOIN LATERAL (
      -- Get last message between me and THIS counterpart for THIS job
      SELECT m.text, m.created_at, m.sender_id, m.read 
      FROM chat_messages m 
      WHERE m.job_id = cwd.r_job_id 
        AND (
          (m.sender_id = p_user_id AND m.receiver_id = cwd.r_cp_id) OR
          (m.sender_id = cwd.r_cp_id AND m.receiver_id = p_user_id)
        )
      ORDER BY m.created_at DESC LIMIT 1
  ) msg ON TRUE
  LEFT JOIN profiles p ON p.id = cwd.r_cp_id
  LEFT JOIN chat_states cs ON cs.job_id = cwd.r_job_id AND cs.user_id = p_user_id
  WHERE (msg.text IS NOT NULL OR cwd.status IN ('IN_PROGRESS', 'COMPLETED') OR EXISTS (SELECT 1 FROM bids b WHERE b.job_id = cwd.r_job_id AND b.worker_id = cwd.r_cp_id))
    AND COALESCE(cs.is_deleted, false) = false
  ORDER BY COALESCE(msg.created_at, cwd.job_created_at) DESC;
END;
$$;

DO $$ BEGIN
  RAISE NOTICE '✅ V18 Conversation-Centric Inbox Deployed.';
END $$;
