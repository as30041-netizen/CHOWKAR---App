-- ============================================
-- OPTIMIZED INBOX QUERY
-- Replaces multiple round-trips with a single RPC
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
  unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH relevant_jobs AS (
    -- Jobs where I am the poster
    SELECT 
      j.id, j.title, j.status, j.poster_id, j.accepted_bid_id,
      b.worker_id as counterpart_id,
      p.name as counterpart_name,
      p.profile_photo as counterpart_photo
    FROM jobs j
    LEFT JOIN bids b ON b.id = j.accepted_bid_id
    LEFT JOIN profiles p ON p.id = b.worker_id
    WHERE j.poster_id = p_user_id 
    AND (j.status = 'IN_PROGRESS' OR j.status = 'COMPLETED')
    
    UNION ALL
    
    -- Jobs where I am the accepted worker
    SELECT 
      j.id, j.title, j.status, j.poster_id, j.accepted_bid_id,
      j.poster_id as counterpart_id,
      p.name as counterpart_name,
      p.profile_photo as counterpart_photo
    FROM jobs j
    JOIN bids b ON b.id = j.accepted_bid_id
    JOIN profiles p ON p.id = j.poster_id
    WHERE b.worker_id = p_user_id
    AND (j.status = 'IN_PROGRESS' OR j.status = 'COMPLETED')
  ),
  message_stats AS (
    -- Get last message and unread count for these jobs
    SELECT 
      m.job_id,
      (SELECT text FROM chat_messages m2 WHERE m2.job_id = m.job_id ORDER BY m2.created_at DESC LIMIT 1) as last_text,
      MAX(m.created_at) as last_time,
      (SELECT sender_id FROM chat_messages m3 WHERE m3.job_id = m.job_id ORDER BY m3.created_at DESC LIMIT 1) as last_sender,
      (SELECT read FROM chat_messages m4 WHERE m4.job_id = m.job_id ORDER BY m4.created_at DESC LIMIT 1) as last_read,
      COUNT(*) FILTER (WHERE m.receiver_id = p_user_id AND m.read = FALSE) as unread
    FROM chat_messages m
    WHERE m.job_id IN (SELECT id FROM relevant_jobs)
    GROUP BY m.job_id
  )
  SELECT 
    rj.id,
    rj.title,
    rj.status,
    rj.poster_id,
    rj.accepted_bid_id,
    rj.counterpart_id,
    rj.counterpart_name,
    rj.counterpart_photo,
    COALESCE(ms.last_text, 'No messages yet'),
    COALESCE(ms.last_time, NOW()),
    ms.last_sender,
    ms.last_read,
    COALESCE(ms.unread, 0)
  FROM relevant_jobs rj
  LEFT JOIN message_stats ms ON ms.job_id = rj.id
  ORDER BY ms.last_time DESC NULLS LAST;
END;
$$;
