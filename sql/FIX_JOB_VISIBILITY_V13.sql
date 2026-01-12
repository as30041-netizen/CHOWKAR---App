-- ============================================
-- FIX JOB VISIBILITY V13
-- 1. Create table for per-user job visibility (hiding cards)
-- 2. Create RPC to hide a job
-- 3. Update get_inbox_summaries to exclude explicitly hidden chats
-- ============================================

-- 1. Visibility Table
CREATE TABLE IF NOT EXISTS user_job_visibility (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  is_hidden BOOLEAN DEFAULT FALSE,
  hidden_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, job_id)
);

-- Enable RLS
ALTER TABLE user_job_visibility ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own visibility"
  ON user_job_visibility
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. RPC to Hide Job
CREATE OR REPLACE FUNCTION hide_job_for_user(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_job_visibility (user_id, job_id, is_hidden)
  VALUES (auth.uid(), p_job_id, TRUE)
  ON CONFLICT (user_id, job_id) DO UPDATE SET is_hidden = TRUE, hidden_at = NOW();
END;
$$;

-- 3. Update get_inbox_summaries to respect visibility
-- (And keep it robust as V12)
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
  WITH my_jobs AS (
    SELECT DISTINCT j.id as r_id
    FROM jobs j
    LEFT JOIN bids b ON b.job_id = j.id
    WHERE (j.poster_id = p_user_id OR b.worker_id = p_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM user_job_visibility v 
        WHERE v.job_id = j.id AND v.user_id = p_user_id AND v.is_hidden = TRUE
      )
  ),
  active_jobs AS (
    SELECT 
      j.id, j.title, j.status, j.poster_id, j.created_at as job_created_at,
      (SELECT worker_id FROM bids WHERE id = j.accepted_bid_id) as hired_uid,
      (SELECT worker_id FROM bids WHERE job_id = j.id AND negotiation_history @> '[{"agreed": true}]' LIMIT 1) as agreed_uid
    FROM jobs j
    JOIN my_jobs mj ON mj.r_id = j.id
    WHERE EXISTS (SELECT 1 FROM chat_messages m WHERE m.job_id = j.id)
       OR j.status IN ('IN_PROGRESS', 'COMPLETED')
  ),
  with_final_counterparty AS (
    SELECT 
      aj.*,
      CASE 
        WHEN aj.poster_id = p_user_id THEN (
          COALESCE(
            aj.hired_uid,
            aj.agreed_uid,
            (SELECT sender_id FROM chat_messages m WHERE m.job_id = aj.id AND m.sender_id != p_user_id ORDER BY created_at DESC LIMIT 1),
            (SELECT receiver_id FROM chat_messages m WHERE m.job_id = aj.id AND m.sender_id = p_user_id AND m.receiver_id IS NOT NULL ORDER BY created_at DESC LIMIT 1),
            (SELECT worker_id FROM bids b WHERE b.job_id = aj.id ORDER BY updated_at DESC LIMIT 1)
          )
        )
        ELSE aj.poster_id
      END as cp_id
    FROM active_jobs aj
  )
  SELECT 
    wfc.id,
    wfc.title,
    wfc.status::TEXT,
    wfc.poster_id,
    wfc.hired_uid,
    wfc.cp_id,
    COALESCE(p.name, 'Chowkar User'),
    p.profile_photo,
    COALESCE(ms.text, 'Chat started! 👋'),
    COALESCE(ms.created_at, wfc.job_created_at),
    ms.sender_id,
    ms.read,
    (SELECT COUNT(*) FROM notifications n WHERE n.user_id = p_user_id AND n.related_job_id = wfc.id AND n.read = false)::BIGINT,
    COALESCE(cs.is_archived, false),
    COALESCE(cs.is_deleted, false)
  FROM with_final_counterparty wfc
  LEFT JOIN LATERAL (
      SELECT m.text, m.created_at, m.sender_id, m.read 
      FROM chat_messages m 
      WHERE m.job_id = wfc.id 
      ORDER BY m.created_at DESC LIMIT 1
  ) ms ON TRUE
  LEFT JOIN profiles p ON p.id = wfc.cp_id
  LEFT JOIN chat_states cs ON cs.job_id = wfc.id AND cs.user_id = p_user_id
  WHERE wfc.cp_id IS NOT NULL 
    AND COALESCE(cs.is_deleted, false) = false
  ORDER BY COALESCE(ms.created_at, wfc.job_created_at) DESC;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ Job Visibility V13 Deployed.';
END $$;
