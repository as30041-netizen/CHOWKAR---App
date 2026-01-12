-- ============================================
-- FIX INBOX VISIBILITY V6
-- Ensures PENDING jobs with AGREED bids show in the Inbox
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
  WITH relevant_jobs AS (
    -- Case A: I am the poster
    SELECT 
      j.id, j.title, j.status, j.poster_id, j.accepted_bid_id,
      COALESCE(b_acc.worker_id, b_agr.worker_id) as counterpart_id
    FROM jobs j
    LEFT JOIN bids b_acc ON b_acc.id = j.accepted_bid_id
    -- Find the bid that has 'agreed: true' in its history if not accepted yet
    LEFT JOIN LATERAL (
        SELECT worker_id FROM bids 
        WHERE job_id = j.id 
        AND negotiation_history @> '[{"agreed": true}]'
        ORDER BY updated_at DESC LIMIT 1
    ) b_agr ON TRUE
    WHERE j.poster_id = p_user_id
    AND (
        j.status IN ('IN_PROGRESS', 'COMPLETED') 
        OR (j.status = 'OPEN' AND b_agr.worker_id IS NOT NULL) -- Show in inbox if agreement reached
    )
    
    UNION ALL
    
    -- Case B: I am the worker (Accepted OR Agreed)
    SELECT 
      j.id, j.title, j.status, j.poster_id, j.accepted_bid_id,
      j.poster_id as counterpart_id
    FROM jobs j
    JOIN bids b ON b.job_id = j.id
    WHERE b.worker_id = p_user_id
    AND (
        (j.status IN ('IN_PROGRESS', 'COMPLETED') AND j.accepted_bid_id = b.id)
        OR (j.status = 'OPEN' AND b.negotiation_history @> '[{"agreed": true}]')
    )
  ),
  message_stats AS (
    SELECT DISTINCT ON (m.job_id)
      m.job_id,
      m.text as last_text,
      m.created_at as last_time,
      m.sender_id as last_sender,
      m.read as last_read
    FROM chat_messages m
    WHERE m.job_id IN (SELECT id FROM relevant_jobs)
    ORDER BY m.job_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      n.related_job_id,
      COUNT(*) as count
    FROM notifications n
    WHERE n.user_id = p_user_id
    AND n.read = false
    GROUP BY n.related_job_id
  )
  SELECT 
    rj.id,
    rj.title,
    rj.status,
    rj.poster_id,
    rj.accepted_bid_id,
    rj.counterpart_id,
    p.name as counterpart_name,
    p.profile_photo as counterpart_photo,
    COALESCE(ms.last_text, 'Agreement reached! 👋'),
    COALESCE(ms.last_time, NOW()),
    ms.last_sender,
    ms.last_read,
    COALESCE(un.count, 0),
    COALESCE(cs.is_archived, FALSE),
    COALESCE(cs.is_deleted, FALSE)
  FROM relevant_jobs rj
  JOIN profiles p ON p.id = rj.counterpart_id
  LEFT JOIN message_stats ms ON ms.job_id = rj.id
  LEFT JOIN unread_counts un ON un.related_job_id = rj.id
  LEFT JOIN chat_states cs ON cs.job_id = rj.id AND cs.user_id = p_user_id
  WHERE rj.counterpart_id IS NOT NULL 
    AND COALESCE(cs.is_deleted, FALSE) = FALSE
  ORDER BY COALESCE(ms.last_time, NOW()) DESC;
END;
$$;
