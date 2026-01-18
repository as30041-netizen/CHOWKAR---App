-- ============================================
-- FIX INBOX V9 (SUPER-ROBUST FINAL)
-- 1. Permissive Visibility: Show chat if hired OR if any message exists
-- 2. Robust Counterpart Mapping
-- 3. Case-Insensitive User Comparisons
-- ============================================

CREATE OR REPLACE FUNCTION get_inbox_summaries(p_user_id UUID)
RETURNS TABLE (
  job_id UUID,
  job_title TEXT,
  job_status TEXT,
  poster_id UUID,
  accepted_bidder_id UUID, -- Worker's User ID
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
    -- Get all jobs I am connected to
    SELECT DISTINCT j.id as r_id
    FROM jobs j
    LEFT JOIN bids b ON b.job_id = j.id
    WHERE j.poster_id = p_user_id 
       OR b.worker_id = p_user_id
  ),
  active_conversations AS (
    -- Only keep jobs that have activity (Hired or Messages)
    SELECT 
      j.id, j.title, j.status, j.poster_id, j.created_at as job_created_at,
      (SELECT worker_id FROM bids WHERE id = j.accepted_bid_id) as accepted_worker_uid
    FROM jobs j
    JOIN my_relevant_jobs rj ON rj.r_id = j.id
    WHERE (j.status IN ('IN_PROGRESS', 'COMPLETED'))
       OR EXISTS (SELECT 1 FROM chat_messages m WHERE m.job_id = j.id)
  ),
  with_counterparty AS (
    -- Figure out who the OTHER person is
    SELECT 
      ac.*,
      CASE 
        WHEN ac.poster_id = p_user_id THEN (
            -- I am poster, find the worker
            COALESCE(
              ac.accepted_worker_uid,
              (SELECT CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END 
               FROM chat_messages m WHERE m.job_id = ac.id ORDER BY m.created_at DESC LIMIT 1)
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
      -- Get latest message details
      SELECT m.text, m.created_at, m.sender_id, m.read 
      FROM chat_messages m 
      WHERE m.job_id = wc.id 
      ORDER BY m.created_at DESC LIMIT 1
  ) ms ON TRUE
  LEFT JOIN profiles p ON p.id = wc.cp_id
  LEFT JOIN chat_states cs ON cs.job_id = wc.id AND cs.user_id = p_user_id
  WHERE (wc.cp_id IS NOT NULL OR wc.status IN ('IN_PROGRESS', 'COMPLETED'))
    AND COALESCE(cs.is_deleted, false) = false
  ORDER BY COALESCE(ms.created_at, wc.job_created_at) DESC;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ Inbox Summaries V9 (SUPER-ROBUST) deployed successfully';
END $$;
