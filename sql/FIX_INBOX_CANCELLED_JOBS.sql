-- ============================================
-- FIX INBOX V25 - Include CANCELLED jobs in Archive
-- CANCELLED jobs now appear in inbox (with COMPLETED) for history access
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
    -- Path A: I am the Poster, show me the thread with my hired worker
    SELECT 
      j.id as t_job_id, 
      b.worker_id as t_cp_id, 
      j.poster_id as t_poster_id, 
      j.accepted_bid_id as t_acc_id
    FROM jobs j
    JOIN bids b ON b.id = j.accepted_bid_id
    WHERE j.poster_id = p_user_id AND j.status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')

    UNION

    -- Path B: I am a Worker whose bid was ACCEPTED, show me the thread with the poster
    -- Uses direct worker_id check on the accepted bid
    SELECT 
      j.id as t_job_id, 
      j.poster_id as t_cp_id, 
      j.poster_id as t_poster_id, 
      j.accepted_bid_id as t_acc_id
    FROM jobs j
    WHERE j.accepted_bid_id IN (SELECT id FROM bids WHERE worker_id = p_user_id)
      AND j.status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')
    
    UNION
    
    -- Path C: Rescue via Messages (Handles edge cases where I sent/received messages)
    SELECT DISTINCT 
      m.job_id as t_job_id, 
      CASE 
        WHEN m.sender_id = p_user_id THEN m.receiver_id 
        ELSE m.sender_id 
      END as t_cp_id,
      j.poster_id as t_poster_id,
      j.accepted_bid_id as t_acc_id
    FROM chat_messages m
    JOIN jobs j ON j.id = m.job_id
    WHERE (m.sender_id = p_user_id OR m.receiver_id = p_user_id)
      AND j.status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')
  ),
  unique_threads AS (
    -- Use DISTINCT ON to get one row per job+counterpart (avoids MAX on UUID)
    SELECT DISTINCT ON (t_job_id, t_cp_id)
      t_job_id, t_cp_id, t_poster_id, t_acc_id
    FROM thread_participants
    WHERE t_cp_id IS NOT NULL AND t_cp_id != p_user_id
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
    COALESCE(m.is_read, TRUE),
    COALESCE(unread.cnt, 0),
    COALESCE(cs.is_archived, FALSE),
    COALESCE(cs.is_deleted, FALSE)
  FROM thread_details td
  LEFT JOIN profiles p ON p.id = td.t_cp_id
  LEFT JOIN LATERAL (
    SELECT cm.text, cm.created_at, cm.sender_id, cm.read as is_read
    FROM chat_messages cm
    WHERE cm.job_id = td.t_job_id AND cm.is_deleted = FALSE
    ORDER BY cm.created_at DESC
    LIMIT 1
  ) m ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as cnt
    FROM chat_messages cm2
    WHERE cm2.job_id = td.t_job_id 
      AND cm2.sender_id = td.t_cp_id
      AND cm2.receiver_id = p_user_id
      AND cm2.read = FALSE
      AND cm2.is_deleted = FALSE
  ) unread ON TRUE
  LEFT JOIN chat_states cs ON cs.job_id = td.t_job_id AND cs.user_id = p_user_id
  ORDER BY COALESCE(m.created_at, td.job_created_at) DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_inbox_summaries(UUID) TO authenticated;
