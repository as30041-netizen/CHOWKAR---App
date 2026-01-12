-- ============================================
-- FIX INBOX V20 (THE HIGH-PRECISION RECOVERY)
-- 1. Corrected Accepted Bid Logic (Bid ID vs Job ID fix)
-- 2. Bid-Centric Pairings (Ensures worker sees poster and vice-versa)
-- 3. Robust Thread Persistence
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
  WITH thread_participants AS (
    -- Path A: I am the Poster, find all workers who bid on my job
    SELECT j.id as t_job_id, b.worker_id as t_cp_id, j.poster_id as t_poster_id
    FROM jobs j
    JOIN bids b ON b.job_id = j.id
    WHERE j.poster_id = p_user_id

    UNION

    -- Path B: I am a Worker, find the Posters of jobs I bid on
    SELECT b.job_id as t_job_id, j.poster_id as t_cp_id, j.poster_id as t_poster_id
    FROM bids b
    JOIN jobs j ON j.id = b.job_id
    WHERE b.worker_id = p_user_id

    UNION

    -- Path C: Rescue legacy chats where a message exists but maybe no bid
    SELECT DISTINCT m.job_id, 
           CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END,
           j.poster_id
    FROM chat_messages m
    JOIN jobs j ON j.id = m.job_id
    WHERE (m.sender_id = p_user_id OR m.receiver_id = p_user_id)
  ),
  unique_threads AS (
    -- Collapse into unique Job + Interaction pairs
    SELECT t_job_id, t_cp_id, MAX(t_poster_id) as t_poster_id
    FROM thread_participants
    WHERE t_cp_id IS NOT NULL AND t_cp_id != p_user_id
    GROUP BY t_job_id, t_cp_id
  ),
  thread_details AS (
    -- Fetch job info and visibility
    SELECT 
      ut.*,
      j.title,
      j.status,
      j.accepted_bid_id,
      j.created_at as job_created_at,
      -- Find if THIS specific counterpart is the one accepted
      (SELECT id FROM bids WHERE job_id = ut.t_job_id AND worker_id = ut.t_cp_id AND id = j.accepted_bid_id LIMIT 1) as confirmed_bid_id
    FROM unique_threads ut
    JOIN jobs j ON j.id = ut.t_job_id
    WHERE NOT EXISTS (
      SELECT 1 FROM user_job_visibility v 
      WHERE v.job_id = ut.t_job_id AND v.user_id = p_user_id AND v.is_hidden = TRUE
    )
  )
  SELECT 
    td.t_job_id,
    td.title,
    td.status::TEXT,
    td.t_poster_id,
    td.confirmed_bid_id, -- Corrected logic: only non-null if this specific person is the worker for the job
    td.t_cp_id,
    COALESCE(p.name, CASE WHEN td.t_cp_id = td.t_poster_id THEN 'Employer' ELSE 'Worker' END),
    p.profile_photo,
    COALESCE(m.text, 'Chat started! 👋'),
    COALESCE(m.created_at, td.job_created_at),
    m.sender_id,
    m.read,
    (SELECT COUNT(*) FROM notifications n WHERE n.user_id = p_user_id AND n.related_job_id = td.t_job_id AND n.read = false)::BIGINT,
    COALESCE(stat.is_archived, false),
    COALESCE(stat.is_deleted, false)
  FROM thread_details td
  LEFT JOIN LATERAL (
    -- Precise message matching for this unique pair
    SELECT last_m.text, last_m.created_at, last_m.sender_id, last_m.read
    FROM chat_messages last_m
    WHERE last_m.job_id = td.t_job_id
      AND (
        (last_m.sender_id = p_user_id AND (last_m.receiver_id = td.t_cp_id OR last_m.receiver_id IS NULL)) OR
        (last_m.sender_id = td.t_cp_id AND (last_m.receiver_id = p_user_id OR last_m.receiver_id IS NULL))
      )
    ORDER BY last_m.created_at DESC LIMIT 1
  ) m ON TRUE
  LEFT JOIN profiles p ON p.id = td.t_cp_id
  LEFT JOIN chat_states stat ON stat.job_id = td.t_job_id AND stat.user_id = p_user_id
  WHERE (m.text IS NOT NULL OR td.status != 'OPEN' OR EXISTS (SELECT 1 FROM bids b WHERE b.job_id = td.t_job_id AND b.worker_id IN (p_user_id, td.t_cp_id)))
    AND COALESCE(stat.is_deleted, false) = false
  ORDER BY COALESCE(m.created_at, td.job_created_at) DESC;
END;
$$;

DO $$ BEGIN
  RAISE NOTICE '✅ V20 Ultimate Precision Inbox Deployed.';
END $$;
