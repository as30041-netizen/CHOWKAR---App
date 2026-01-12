-- ============================================
-- FIX INBOX V21 (RESTRICTED CHAT - HIRE ONLY)
-- 1. Restrict get_inbox_summaries to only show HIRED/COMPLETED jobs
-- 2. Prevent chat threads from appearing for OPEN jobs (Negotiation phase)
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
    -- Path A: I am the Poster, find the worker who is HIRED
    SELECT j.id as t_job_id, b.worker_id as t_cp_id, j.poster_id as t_poster_id, j.accepted_bid_id as t_acc_id
    FROM jobs j
    JOIN bids b ON b.id = j.accepted_bid_id
    WHERE j.poster_id = p_user_id AND j.status IN ('IN_PROGRESS', 'COMPLETED')

    UNION

    -- Path B: I am a Worker, find the Posters of jobs where I am HIRED
    SELECT j.id as t_job_id, j.poster_id as t_cp_id, j.poster_id as t_poster_id, j.accepted_bid_id as t_acc_id
    FROM jobs j
    JOIN bids b ON b.id = j.accepted_bid_id
    WHERE b.worker_id = p_user_id AND j.status IN ('IN_PROGRESS', 'COMPLETED')
    
    UNION
    
    -- Path C: Rescue for any user who still has unread notifications/messages on ANY job 
    -- (This ensures you don't lose access to the chat record of a completed job)
    SELECT DISTINCT m.job_id as t_job_id, 
           CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END as t_cp_id,
           j.poster_id as t_poster_id,
           j.accepted_bid_id as t_acc_id
    FROM chat_messages m
    JOIN jobs j ON j.id = m.job_id
    WHERE (m.sender_id = p_user_id OR m.receiver_id = p_user_id)
      AND j.status IN ('IN_PROGRESS', 'COMPLETED')
  ),
  unique_threads AS (
    SELECT t_job_id, t_cp_id, MAX(t_poster_id) as t_poster_id, MAX(t_acc_id) as t_acc_id
    FROM thread_participants
    WHERE t_cp_id IS NOT NULL AND t_cp_id != p_user_id
    GROUP BY t_job_id, t_cp_id
  ),
  thread_details AS (
    SELECT 
      ut.*,
      j.title,
      j.status,
      j.created_at as job_created_at
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
    td.t_acc_id as accepted_bidder_id,
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
  WHERE (td.status != 'OPEN') -- STRICT REQUIREMENT: Only show in inbox if job is IN_PROGRESS or COMPLETED
    AND COALESCE(stat.is_deleted, false) = false
  ORDER BY COALESCE(m.created_at, td.job_created_at) DESC;
END;
$$;

DO $$ BEGIN
  RAISE NOTICE '✅ V21 Restricted (Hired-Only) Inbox Deployed.';
END $$;
