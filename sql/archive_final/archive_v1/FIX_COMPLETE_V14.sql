-- ============================================
-- FIX COMPLETE V14 (ULTIMATE SYNC)
-- 1. Job Visibility Table (Hide cards)
-- 2. Inbox Rescue (Show all chats even pre-hire)
-- 3. Robust Cancellation
-- ============================================

-- A. CLEANUP OLD FUNCTIONS
DROP FUNCTION IF EXISTS cancel_job_with_refund(UUID, TEXT);
DROP FUNCTION IF EXISTS get_inbox_summaries(UUID);
DROP FUNCTION IF EXISTS hide_job_for_user(UUID);

-- B. VISIBILITY TABLE
CREATE TABLE IF NOT EXISTS user_job_visibility (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  is_hidden BOOLEAN DEFAULT FALSE,
  hidden_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, job_id)
);

DO $$ BEGIN
  ALTER TABLE user_job_visibility ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DROP POLICY IF EXISTS "Users can manage their own visibility" ON user_job_visibility;
CREATE POLICY "Users can manage their own visibility"
  ON user_job_visibility FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- C. HIDE JOB RPC
CREATE OR REPLACE FUNCTION hide_job_for_user(p_job_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_job_visibility (user_id, job_id, is_hidden)
  VALUES (auth.uid(), p_job_id, TRUE)
  ON CONFLICT (user_id, job_id) DO UPDATE SET is_hidden = TRUE, hidden_at = NOW();
END;
$$;

-- D. ROBUST CANCELLATION
CREATE OR REPLACE FUNCTION cancel_job_with_refund(
  p_job_id UUID,
  p_reason TEXT DEFAULT 'Cancelled'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_worker_id UUID;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id AND poster_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF v_job.accepted_bid_id IS NOT NULL THEN
    SELECT worker_id INTO v_worker_id FROM bids WHERE id = v_job.accepted_bid_id;
  END IF;

  UPDATE jobs SET status = 'COMPLETED', updated_at = NOW() WHERE id = p_job_id;

  IF v_worker_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (v_worker_id, 'WARNING', 'Job Cancelled ⚠️', 'The employer cancelled "' || v_job.title || '".', p_job_id, false, NOW());
    UPDATE bids SET status = 'REJECTED' WHERE id = v_job.accepted_bid_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- E. ULTIMATE INBOX SUMMARY (RESCUE EDITION)
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
  WITH my_involvement AS (
    -- Any job where I am poster or have a bid, and NOT hidden
    SELECT DISTINCT j.id as r_id
    FROM jobs j
    LEFT JOIN bids b ON b.job_id = j.id
    WHERE (j.poster_id = p_user_id OR b.worker_id = p_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM user_job_visibility v 
        WHERE v.job_id = j.id AND v.user_id = p_user_id AND v.is_hidden = TRUE
      )
  ),
  active_set AS (
    -- Include if messages exist OR hired/completed
    SELECT 
      j.id, j.title, j.status, j.poster_id, j.created_at,
      (SELECT worker_id FROM bids WHERE id = j.accepted_bid_id) as hired_uid,
      (SELECT worker_id FROM bids WHERE job_id = j.id AND negotiation_history @> '[{"agreed": true}]' LIMIT 1) as agreed_uid
    FROM jobs j
    JOIN my_involvement mi ON mi.r_id = j.id
    WHERE EXISTS (SELECT 1 FROM chat_messages m WHERE m.job_id = j.id)
       OR j.status IN ('IN_PROGRESS', 'COMPLETED')
  ),
  with_cp AS (
    -- Who is the other person?
    SELECT 
      ase.*,
      CASE 
        WHEN ase.poster_id = p_user_id THEN (
          COALESCE(
            ase.hired_uid,
            ase.agreed_uid,
            (SELECT sender_id FROM chat_messages m WHERE m.job_id = ase.id AND m.sender_id != p_user_id ORDER BY created_at DESC LIMIT 1),
            (SELECT receiver_id FROM chat_messages m WHERE m.job_id = ase.id AND m.sender_id = p_user_id AND m.receiver_id IS NOT NULL ORDER BY created_at DESC LIMIT 1),
            (SELECT worker_id FROM bids b WHERE b.job_id = ase.id ORDER BY updated_at DESC LIMIT 1)
          )
        )
        ELSE ase.poster_id
      END as cp_id
    FROM active_set ase
  )
  SELECT 
    cp.id as job_id,
    cp.title as job_title,
    cp.status::TEXT as job_status,
    cp.poster_id,
    cp.hired_uid as accepted_bidder_id,
    cp.cp_id as counterpart_id,
    COALESCE(prof.name, 'Chowkar User'),
    prof.profile_photo,
    COALESCE(msg.text, 'Chat started! 👋'),
    COALESCE(msg.created_at, cp.created_at),
    msg.sender_id,
    msg.read,
    (SELECT COUNT(*) FROM notifications n WHERE n.user_id = p_user_id AND n.related_job_id = cp.id AND n.read = false)::BIGINT,
    COALESCE(stat.is_archived, false),
    COALESCE(stat.is_deleted, false)
  FROM with_cp cp
  LEFT JOIN LATERAL (
      SELECT m.text, m.created_at, m.sender_id, m.read 
      FROM chat_messages m 
      WHERE m.job_id = cp.id 
      ORDER BY m.created_at DESC LIMIT 1
  ) msg ON TRUE
  LEFT JOIN profiles prof ON prof.id = cp.cp_id
  LEFT JOIN chat_states stat ON stat.job_id = cp.id AND stat.user_id = p_user_id
  WHERE cp.cp_id IS NOT NULL 
    AND COALESCE(stat.is_deleted, false) = false
  ORDER BY COALESCE(msg.created_at, cp.created_at) DESC;
END;
$$;

DO $$ BEGIN
  RAISE NOTICE '✅ Ultimate Sync V14 Deployed Correcty.';
END $$;
