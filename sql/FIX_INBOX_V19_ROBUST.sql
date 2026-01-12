-- ============================================
-- FIX INBOX V19 (ULTRA-ROBUST CONVERSATION RESCUE)
-- 1. Redesigned get_inbox_summaries with multi-path counterpart detection
-- 2. Ensures visibility for all relevant participants (Poster & Workers)
-- 3. Safety for NULL receiver_id or missing profiles
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
  WITH all_relevant_pairings AS (
    -- Path 1: I am the poster, find all bidders
    SELECT j.id as r_job_id, b.worker_id as r_cp_id, j.poster_id as r_poster_id
    FROM jobs j
    JOIN bids b ON b.job_id = j.id
    WHERE j.poster_id = p_user_id

    UNION

    -- Path 2: I am a worker who bid on a job
    SELECT b.job_id as r_job_id, j.poster_id as r_cp_id, j.poster_id as r_poster_id
    FROM bids b
    JOIN jobs j ON j.id = b.job_id
    WHERE b.worker_id = p_user_id

    UNION

    -- Path 3: I am the poster, find anyone who messaged me on my job (in case bid was deleted)
    SELECT DISTINCT m.job_id, m.sender_id, j.poster_id
    FROM chat_messages m
    JOIN jobs j ON j.id = m.job_id
    WHERE j.poster_id = p_user_id AND m.sender_id != p_user_id

    UNION

    -- Path 4: I am the poster, find anyone I messaged on my job
    SELECT DISTINCT m.job_id, m.receiver_id, j.poster_id
    FROM chat_messages m
    JOIN jobs j ON j.id = m.job_id
    WHERE j.poster_id = p_user_id AND m.receiver_id != p_user_id AND m.receiver_id IS NOT NULL

    UNION

    -- Path 5: I am a worker who received a message on a job
    SELECT DISTINCT m.job_id, j.poster_id, j.poster_id
    FROM chat_messages m
    JOIN jobs j ON j.id = m.job_id
    WHERE m.receiver_id = p_user_id AND j.poster_id != p_user_id
  ),
  distinct_convos AS (
    -- Group by unique Job + Person pairing
    SELECT r_job_id, r_cp_id, MAX(r_poster_id) as r_poster_id
    FROM all_relevant_pairings
    WHERE r_cp_id IS NOT NULL
    GROUP BY r_job_id, r_cp_id
  ),
  filtered_convos AS (
    -- Remove hidden/deleted jobs for this specific user
    SELECT dc.*
    FROM distinct_convos dc
    WHERE NOT EXISTS (
      SELECT 1 FROM user_job_visibility v 
      WHERE v.job_id = dc.r_job_id AND v.user_id = p_user_id AND v.is_hidden = TRUE
    )
  ),
  convos_with_meta AS (
    SELECT 
      fc.*,
      j.title,
      j.status,
      j.accepted_bid_id,
      (SELECT id FROM bids WHERE job_id = fc.r_job_id AND worker_id = fc.r_cp_id LIMIT 1) as specific_bid_id,
      j.created_at as job_created_at
    FROM filtered_convos fc
    JOIN jobs j ON j.id = fc.r_job_id
  )
  SELECT 
    cwm.r_job_id as job_id,
    cwm.title as job_title,
    cwm.status::TEXT as job_status,
    cwm.r_poster_id as poster_id,
    CASE WHEN cwm.specific_bid_id = (SELECT id FROM jobs WHERE id = cwm.r_job_id AND accepted_bid_id IS NOT NULL) 
         THEN cwm.specific_bid_id ELSE NULL END as accepted_bidder_id,
    cwm.r_cp_id as counterpart_id,
    COALESCE(p.name, 'Chowkar User'),
    p.profile_photo,
    COALESCE(msg.text, 'Chat started! 👋'),
    COALESCE(msg.created_at, cwm.job_created_at),
    msg.sender_id,
    msg.read,
    (SELECT COUNT(*) FROM notifications n WHERE n.user_id = p_user_id AND n.related_job_id = cwm.r_job_id AND n.read = false)::BIGINT,
    COALESCE(stat.is_archived, false),
    COALESCE(stat.is_deleted, false)
  FROM convos_with_meta cwm
  LEFT JOIN LATERAL (
      -- Get last message between me and THIS specific counterpart for THIS job
      SELECT m.text, m.created_at, m.sender_id, m.read 
      FROM chat_messages m 
      WHERE m.job_id = cwm.r_job_id 
        AND (
          (m.sender_id = p_user_id AND (m.receiver_id = cwm.r_cp_id OR m.receiver_id IS NULL)) OR
          (m.sender_id = cwm.r_cp_id AND (m.receiver_id = p_user_id OR m.receiver_id IS NULL))
        )
      ORDER BY m.created_at DESC LIMIT 1
  ) msg ON TRUE
  LEFT JOIN profiles p ON p.id = cwm.r_cp_id
  LEFT JOIN chat_states stat ON stat.job_id = cwm.r_job_id AND stat.user_id = p_user_id
  WHERE (msg.text IS NOT NULL OR cwm.specific_bid_id IS NOT NULL)
    AND COALESCE(stat.is_deleted, false) = false
  ORDER BY COALESCE(msg.created_at, cwm.job_created_at) DESC;
END;
$$;

DO $$ BEGIN
  RAISE NOTICE '✅ V19 Ultra-Robust Inbox Deployed Successfully.';
END $$;
