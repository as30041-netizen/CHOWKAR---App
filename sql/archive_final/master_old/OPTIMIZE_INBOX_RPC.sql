-- ============================================================================
-- OPTIMIZED INBOX QUERY (V2)
-- Thread-based grouping: Shows all conversations, including OPEN jobs.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_inbox_summaries(p_user_id UUID)
RETURNS TABLE (
  job_id UUID,
  job_title TEXT,
  job_status TEXT,
  poster_id UUID,
  accepted_bid_id UUID,
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
  WITH thread_summaries AS (
    -- Identify the "other person" in every thread I'm part of
    SELECT 
      m.job_id,
      CASE 
        WHEN m.sender_id = p_user_id THEN m.receiver_id
        ELSE m.sender_id
      END AS other_user_id,
      MAX(m.created_at) as last_time
    FROM chat_messages m
    WHERE m.sender_id = p_user_id OR m.receiver_id = p_user_id
    GROUP BY m.job_id, other_user_id
  ),
  message_details AS (
    -- Get the actual last message details for each thread
    SELECT DISTINCT ON (ts.job_id, ts.other_user_id)
      ts.job_id,
      ts.other_user_id,
      ts.last_time,
      m.text as last_text,
      m.sender_id as last_sender,
      m.read as last_read
    FROM thread_summaries ts
    JOIN chat_messages m ON m.job_id = ts.job_id 
      AND m.created_at = ts.last_time
      AND (
        (m.sender_id = p_user_id AND m.receiver_id = ts.other_user_id) OR
        (m.sender_id = ts.other_user_id AND m.receiver_id = p_user_id)
      )
    ORDER BY ts.job_id, ts.other_user_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      m.job_id,
      m.sender_id as other_user_id,
      COUNT(*) as unread
    FROM chat_messages m
    WHERE m.receiver_id = p_user_id AND m.read = FALSE
    GROUP BY m.job_id, m.sender_id
  )
  SELECT 
    j.id as job_id,
    j.title as job_title,
    j.status::TEXT as job_status,
    j.poster_id,
    j.accepted_bid_id,
    md.other_user_id as counterpart_id,
    p.name as counterpart_name,
    p.profile_photo as counterpart_photo,
    md.last_text as last_message_text,
    md.last_time as last_message_time,
    md.last_sender as last_message_sender_id,
    md.last_read as last_message_is_read,
    COALESCE(uc.unread, 0) as unread_count
  FROM message_details md
  JOIN jobs j ON j.id = md.job_id
  JOIN profiles p ON p.id = md.other_user_id
  LEFT JOIN unread_counts uc ON uc.job_id = md.job_id AND uc.other_user_id = md.other_user_id
  ORDER BY md.last_time DESC;
END;
$$;
