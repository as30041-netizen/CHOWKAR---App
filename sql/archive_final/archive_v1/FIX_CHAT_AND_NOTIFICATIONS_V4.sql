-- ============================================
-- FIX CHAT, INBOX, AND NOTIFICATIONS V4
-- 1. Implement Chat Archiving/Deletion per User
-- 2. Fix Mark Read logic (Sync notifications and messages)
-- 3. Optimize Inbox Query (Robustness and Filtering)
-- ============================================

-- 1. Create table for per-user chat state (archived/deleted)
CREATE TABLE IF NOT EXISTS chat_states (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, job_id)
);

-- Enable RLS for chat_states
ALTER TABLE chat_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own chat states" ON chat_states;
CREATE POLICY "Users can manage their own chat states"
ON chat_states FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. Implement Archiving/Deletion RPCs properly
CREATE OR REPLACE FUNCTION archive_chat(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO chat_states (user_id, job_id, is_archived, updated_at)
    VALUES (auth.uid(), p_job_id, TRUE, NOW())
    ON CONFLICT (user_id, job_id) 
    DO UPDATE SET is_archived = TRUE, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION unarchive_chat(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE chat_states
    SET is_archived = FALSE, updated_at = NOW()
    WHERE user_id = auth.uid() AND job_id = p_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION delete_chat(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO chat_states (user_id, job_id, is_deleted, updated_at)
    VALUES (auth.uid(), p_job_id, TRUE, NOW())
    ON CONFLICT (user_id, job_id) 
    DO UPDATE SET is_deleted = TRUE, updated_at = NOW();
END;
$$;

-- 3. Update Mark Read logic for both notifications and messages
CREATE OR REPLACE FUNCTION mark_messages_read(
  p_job_id UUID,
  p_user_id UUID -- Note: This parameter is kept for compatibility with existing calls
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actual_user_id UUID;
BEGIN
    v_actual_user_id := auth.uid();
    IF v_actual_user_id IS NULL THEN
        v_actual_user_id := p_user_id; -- Fallback for background tasks if any
    END IF;

    -- 1. Mark notifications in this job as read
    UPDATE notifications
    SET read = TRUE, updated_at = NOW()
    WHERE user_id = v_actual_user_id
      AND related_job_id = p_job_id
      AND read = FALSE; -- Mark ALL notifications for this job as read (including bid ones)
    
    -- 2. Mark chat messages as read
    UPDATE chat_messages
    SET read = TRUE, read_at = NOW()
    WHERE job_id = p_job_id
      AND receiver_id = v_actual_user_id
      AND read = FALSE;

    RAISE NOTICE '✅ Messages and notifications marked as read for job % user %', p_job_id, v_actual_user_id;
END;
$$;

-- 4. Re-implement get_inbox_summaries with chat_states support
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
      b.worker_id as counterpart_id
    FROM jobs j
    JOIN bids b ON b.id = j.accepted_bid_id
    WHERE j.poster_id = p_user_id
    AND (j.status = 'IN_PROGRESS' OR j.status = 'COMPLETED')
    
    UNION ALL
    
    -- Case B: I am the accepted worker
    SELECT 
      j.id, j.title, j.status, j.poster_id, j.accepted_bid_id,
      j.poster_id as counterpart_id
    FROM jobs j
    JOIN bids b ON b.id = j.accepted_bid_id
    WHERE b.worker_id = p_user_id
    AND (j.status = 'IN_PROGRESS' OR j.status = 'COMPLETED')
  ),
  message_stats AS (
    -- Get last message for each job using DISTINCT ON for performance
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
    -- Use notifications table for unread parity with UI
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
    COALESCE(ms.last_text, 'Chat started! 👋'),
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
  -- Filter out DELETED chats by default (Frontend handles archived toggle)
  WHERE COALESCE(cs.is_deleted, FALSE) = FALSE
  ORDER BY COALESCE(ms.last_time, NOW()) DESC;
END;
$$;

-- 5. Fix notify_on_chat_message trigger for accurate receiver_id
CREATE OR REPLACE FUNCTION notify_on_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_name TEXT;
  v_job_title TEXT;
BEGIN
  -- 1. Identify recipient
  -- If I am the poster, recipient is accepted worker
  -- If I am the worker, recipient is poster
  SELECT 
    CASE 
      WHEN NEW.sender_id = j.poster_id THEN b.worker_id 
      ELSE j.poster_id 
    END INTO v_recipient_id
  FROM jobs j
  JOIN bids b ON b.id = j.accepted_bid_id
  WHERE j.id = NEW.job_id;

  -- 2. Validate recipient
  IF v_recipient_id IS NULL THEN
    RETURN NEW; -- No active participant found (job might have changed)
  END IF;

  -- 3. Get metadata for notification content
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;

  -- 4. Create Notification
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (
    v_recipient_id,
    'INFO',
    v_sender_name || ' 💬',
    '\"' || v_job_title || '\": ' || LEFT(NEW.text, 50) || CASE WHEN LENGTH(NEW.text) > 50 THEN '...' ELSE '' END,
    NEW.job_id,
    false,
    NOW()
  );

  RETURN NEW;
END;
$$;

-- 6. Re-attach trigger
DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON chat_messages;
CREATE TRIGGER trigger_notify_on_chat_message
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION notify_on_chat_message();

-- 7. Success Banner
DO $$
BEGIN
  RAISE NOTICE '✅ Chat and Notification fixes applied successfully';
END $$;
