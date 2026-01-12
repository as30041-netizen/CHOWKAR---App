-- ============================================
-- FIX INBOX AND DATA MAPPING V8 (FINAL ROBUST VERSION)
-- 1. Fix get_inbox_summaries (Return Worker UID, not Bid UID)
-- 2. Improved Handshake (Agreed) visibility
-- 3. Left Join for Profiles to prevent missing results
-- ============================================

CREATE OR REPLACE FUNCTION get_inbox_summaries(p_user_id UUID)
RETURNS TABLE (
  job_id UUID,
  job_title TEXT,
  job_status TEXT,
  poster_id UUID,
  accepted_bidder_id UUID, -- This will now correctly be the WORKER'S profile ID (User UUID)
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
  WITH relevant_parts AS (
    -- Case A: User is the Poster
    SELECT 
      j.id as rid, j.title, j.status, j.poster_id,
      COALESCE(b_acc.worker_id, b_agr.worker_id) as counterpart_user_id,
      COALESCE(b_acc.worker_id, b_agr.worker_id) as worker_uid
    FROM jobs j
    LEFT JOIN bids b_acc ON b_acc.id = j.accepted_bid_id
    LEFT JOIN LATERAL (
        -- Find a worker who has "Agreed" if not accepted yet
        SELECT worker_id FROM bids 
        WHERE bids.job_id = j.id 
        AND (
            negotiation_history @> '[{"agreed": true}]'
            OR
            EXISTS (
                SELECT 1 FROM chat_messages m 
                WHERE m.job_id = j.id 
                AND (m.sender_id = bids.worker_id OR m.receiver_id = bids.worker_id)
                LIMIT 1
            )
        )
        ORDER BY updated_at DESC LIMIT 1
    ) b_agr ON TRUE
    WHERE j.poster_id = p_user_id
    AND (
        j.status IN ('IN_PROGRESS', 'COMPLETED') 
        OR (j.status = 'OPEN' AND b_agr.worker_id IS NOT NULL)
    )

    UNION ALL

    -- Case B: User is a Worker (Accepted or Agreed/Chatting)
    SELECT 
      j.id as rid, j.title, j.status, j.poster_id,
      j.poster_id as counterpart_user_id,
      b.worker_id as worker_uid
    FROM jobs j
    JOIN bids b ON b.job_id = j.id
    WHERE b.worker_id = p_user_id
    AND (
        (j.status IN ('IN_PROGRESS', 'COMPLETED') AND j.accepted_bid_id = b.id)
        OR (j.status = 'OPEN' AND (
            b.negotiation_history @> '[{"agreed": true}]'
            OR
            EXISTS (
                SELECT 1 FROM chat_messages m 
                WHERE m.job_id = j.id 
                AND (m.sender_id = p_user_id OR m.receiver_id = p_user_id)
                LIMIT 1
            )
        ))
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
    WHERE m.job_id IN (SELECT rid FROM relevant_parts)
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
    rp.rid,
    rp.title,
    rp.status::TEXT,
    rp.poster_id,
    rp.worker_uid,       -- This maps to accepted_bidder_id (must be Worker UID)
    rp.counterpart_user_id, -- This maps to counterpart_id
    COALESCE(p.name, 'Chowkar User'),
    p.profile_photo,
    COALESCE(ms.last_text, 'Chat started! 👋'),
    COALESCE(ms.last_time, NOW()),
    ms.last_sender,
    ms.last_read,
    COALESCE(un.count, 0)::BIGINT,
    COALESCE(cs.is_archived, FALSE),
    COALESCE(cs.is_deleted, FALSE)
  FROM relevant_parts rp
  LEFT JOIN profiles p ON p.id = rp.counterpart_user_id
  LEFT JOIN message_stats ms ON ms.job_id = rp.rid
  LEFT JOIN unread_counts un ON un.related_job_id = rp.rid
  LEFT JOIN chat_states cs ON cs.job_id = rp.rid AND cs.user_id = p_user_id
  WHERE rp.counterpart_user_id IS NOT NULL 
    AND COALESCE(cs.is_deleted, FALSE) = FALSE
  ORDER BY COALESCE(ms.last_time, NOW()) DESC;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ Inbox Summaries V8 (Robust Mapping) deployed successfully';
END $$;
