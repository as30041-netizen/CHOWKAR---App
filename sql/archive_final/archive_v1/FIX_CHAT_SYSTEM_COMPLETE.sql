-- ============================================
-- CHAT SYSTEM COMPLETE FIX
-- Fixes all issues found in audit:
-- 1. Archive/Unarchive/Delete RPCs (use chat_states)
-- 2. soft_delete_chat_message (soft delete, not hard)
-- 3. mark_messages_read (update both notifications AND messages)
-- 4. Ensure chat_states table exists
-- 5. Ensure user_blocks table exists with proper RPCs
-- ============================================

-- ============================================
-- STEP 1: Ensure Required Tables Exist
-- ============================================

-- 1A. chat_states table for per-user archive/delete state
CREATE TABLE IF NOT EXISTS chat_states (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, job_id)
);

ALTER TABLE chat_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own chat states" ON chat_states;
CREATE POLICY "Users can manage their own chat states"
ON chat_states FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 1B. user_blocks table for blocking users
CREATE TABLE IF NOT EXISTS user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own blocks" ON user_blocks;
CREATE POLICY "Users can manage their own blocks"
ON user_blocks FOR ALL
USING (blocker_id = auth.uid())
WITH CHECK (blocker_id = auth.uid());

-- Add is_deleted column to chat_messages if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'is_deleted'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add read and read_at columns to chat_messages if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'read'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN read BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'read_at'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN read_at TIMESTAMPTZ;
    END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '✅ Step 1: Required tables and columns verified'; END $$;

-- ============================================
-- STEP 2: Drop and Recreate Chat RPCs
-- ============================================

-- Drop existing versions to avoid conflicts
DROP FUNCTION IF EXISTS archive_chat(UUID);
DROP FUNCTION IF EXISTS unarchive_chat(UUID);
DROP FUNCTION IF EXISTS delete_chat(UUID);
DROP FUNCTION IF EXISTS soft_delete_chat_message(UUID);
DROP FUNCTION IF EXISTS mark_messages_read(UUID, UUID);
DROP FUNCTION IF EXISTS block_user(UUID);
DROP FUNCTION IF EXISTS unblock_user(UUID);
DROP FUNCTION IF EXISTS check_relationship_status(UUID);

-- ============================================
-- 2A. archive_chat - Sets is_archived=true in chat_states
-- ============================================
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
    
    RAISE NOTICE '✅ Chat archived for job % by user %', p_job_id, auth.uid();
END;
$$;

-- ============================================
-- 2B. unarchive_chat - Sets is_archived=false in chat_states
-- ============================================
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
    
    -- If no row existed, that's fine - chat wasn't archived
    RAISE NOTICE '✅ Chat unarchived for job % by user %', p_job_id, auth.uid();
END;
$$;

-- ============================================
-- 2C. delete_chat - Soft delete (per-user visibility)
-- ============================================
CREATE OR REPLACE FUNCTION delete_chat(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Soft delete: Mark as deleted for THIS user only
    INSERT INTO chat_states (user_id, job_id, is_deleted, updated_at)
    VALUES (auth.uid(), p_job_id, TRUE, NOW())
    ON CONFLICT (user_id, job_id) 
    DO UPDATE SET is_deleted = TRUE, updated_at = NOW();
    
    RAISE NOTICE '✅ Chat soft-deleted for job % by user %', p_job_id, auth.uid();
END;
$$;

-- ============================================
-- 2D. soft_delete_chat_message - Soft delete single message
-- ============================================
CREATE OR REPLACE FUNCTION soft_delete_chat_message(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Soft delete: Mark as deleted, replace text
    UPDATE chat_messages
    SET 
        is_deleted = TRUE,
        text = 'This message was deleted'
    WHERE id = p_message_id 
      AND sender_id = auth.uid();  -- Only sender can delete their own message
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found or you are not the sender';
    END IF;
    
    RAISE NOTICE '✅ Message soft-deleted: %', p_message_id;
END;
$$;


-- ============================================
-- 2E. mark_messages_read - Update BOTH notifications AND messages
-- ============================================
CREATE OR REPLACE FUNCTION mark_messages_read(
  p_job_id UUID,
  p_user_id UUID  -- Kept for compatibility, but we prefer auth.uid()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actual_user_id UUID;
BEGIN
    -- Prefer auth.uid(), fallback to parameter for background tasks
    v_actual_user_id := COALESCE(auth.uid(), p_user_id);
    
    IF v_actual_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID required';
    END IF;

    -- 1. Mark notifications as read for this job
    UPDATE notifications
    SET read = TRUE, updated_at = NOW()
    WHERE user_id = v_actual_user_id
      AND related_job_id = p_job_id
      AND read = FALSE;
    
    -- 2. Mark chat messages as read (where I am the receiver)
    UPDATE chat_messages
    SET read = TRUE, read_at = NOW()
    WHERE job_id = p_job_id
      AND receiver_id = v_actual_user_id
      AND read = FALSE;

    RAISE NOTICE '✅ Messages and notifications marked read for job % user %', p_job_id, v_actual_user_id;
END;
$$;

-- ============================================
-- 2F. block_user - Block another user
-- ============================================
CREATE OR REPLACE FUNCTION block_user(p_blocked_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO user_blocks (blocker_id, blocked_id, created_at)
    VALUES (auth.uid(), p_blocked_id, NOW())
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
    
    RAISE NOTICE '✅ User % blocked by %', p_blocked_id, auth.uid();
END;
$$;

-- ============================================
-- 2G. unblock_user - Unblock a user
-- ============================================
CREATE OR REPLACE FUNCTION unblock_user(p_blocked_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM user_blocks
    WHERE blocker_id = auth.uid() AND blocked_id = p_blocked_id;
    
    RAISE NOTICE '✅ User % unblocked by %', p_blocked_id, auth.uid();
END;
$$;

-- ============================================
-- 2H. check_relationship_status - Get blocking status
-- ============================================
CREATE OR REPLACE FUNCTION check_relationship_status(p_other_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_i_blocked BOOLEAN;
    v_they_blocked_me BOOLEAN;
BEGIN
    -- Check if I blocked them
    SELECT EXISTS (
        SELECT 1 FROM user_blocks 
        WHERE blocker_id = auth.uid() AND blocked_id = p_other_user_id
    ) INTO v_i_blocked;
    
    -- Check if they blocked me
    SELECT EXISTS (
        SELECT 1 FROM user_blocks 
        WHERE blocker_id = p_other_user_id AND blocked_id = auth.uid()
    ) INTO v_they_blocked_me;
    
    RETURN json_build_object(
        'i_blocked', v_i_blocked,
        'they_blocked_me', v_they_blocked_me
    );
END;
$$;

DO $$ BEGIN RAISE NOTICE '✅ Step 2: All chat RPCs created/updated'; END $$;

-- ============================================
-- STEP 3: Grant Execute Permissions
-- ============================================

GRANT EXECUTE ON FUNCTION archive_chat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unarchive_chat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_chat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_chat_message(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION block_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unblock_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_relationship_status(UUID) TO authenticated;

DO $$ BEGIN RAISE NOTICE '✅ Step 3: Execute permissions granted'; END $$;

-- ============================================
-- STEP 4: Fix chat message notification trigger
-- ============================================

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
  -- Skip if message is deleted
  IF NEW.is_deleted THEN
    RETURN NEW;
  END IF;

  -- Identify recipient: If I'm poster, notify worker. If I'm worker, notify poster.
  SELECT 
    CASE 
      WHEN NEW.sender_id = j.poster_id THEN b.worker_id 
      ELSE j.poster_id 
    END INTO v_recipient_id
  FROM jobs j
  LEFT JOIN bids b ON b.id = j.accepted_bid_id
  WHERE j.id = NEW.job_id;

  -- Validate recipient exists
  IF v_recipient_id IS NULL THEN
    RETURN NEW; -- No valid recipient (job may have changed)
  END IF;

  -- Skip if sender = recipient (edge case)
  IF v_recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  -- Get metadata for notification
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;

  -- Create notification
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (
    v_recipient_id,
    'INFO',
    COALESCE(v_sender_name, 'Someone') || ' 💬',
    '"' || COALESCE(v_job_title, 'Job') || '": ' || LEFT(NEW.text, 50) || CASE WHEN LENGTH(NEW.text) > 50 THEN '...' ELSE '' END,
    NEW.job_id,
    false,
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Reattach trigger
DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON chat_messages;
CREATE TRIGGER trigger_notify_on_chat_message
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION notify_on_chat_message();

DO $$ BEGIN RAISE NOTICE '✅ Step 4: Chat notification trigger updated'; END $$;

-- ============================================
-- STEP 5: Ensure user_job_visibility table exists (for inbox filtering)
-- ============================================
CREATE TABLE IF NOT EXISTS user_job_visibility (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    is_hidden BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, job_id)
);

ALTER TABLE user_job_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own job visibility" ON user_job_visibility;
CREATE POLICY "Users can manage their own job visibility"
ON user_job_visibility FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DO $$ BEGIN RAISE NOTICE '✅ Step 5: user_job_visibility table verified'; END $$;

-- ============================================
-- STEP 6: Create get_inbox_summaries RPC
-- This is the CRITICAL function for the Inbox/Chat list
-- ============================================
DROP FUNCTION IF EXISTS get_inbox_summaries(UUID);

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
    WHERE j.poster_id = p_user_id AND j.status IN ('IN_PROGRESS', 'COMPLETED')

    UNION

    -- Path B: I am a Worker, show me the thread with the poster of my hired job
    SELECT 
      j.id as t_job_id, 
      j.poster_id as t_cp_id, 
      j.poster_id as t_poster_id, 
      j.accepted_bid_id as t_acc_id
    FROM jobs j
    JOIN bids b ON b.id = j.accepted_bid_id
    WHERE b.worker_id = p_user_id AND j.status IN ('IN_PROGRESS', 'COMPLETED')
    
    UNION
    
    -- Path C: Rescue via Messages (Handles cases where receiver_id might be null or metadata slightly off)
    SELECT DISTINCT 
      m.job_id as t_job_id, 
      COALESCE(
        CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END,
        CASE WHEN j.poster_id = p_user_id THEN (SELECT worker_id FROM bids WHERE id = j.accepted_bid_id) ELSE j.poster_id END
      ) as t_cp_id,
      j.poster_id as t_poster_id,
      j.accepted_bid_id as t_acc_id
    FROM chat_messages m
    JOIN jobs j ON j.id = m.job_id
    WHERE (m.sender_id = p_user_id OR m.receiver_id = p_user_id)
      AND j.status IN ('IN_PROGRESS', 'COMPLETED')
  ),
  -- FIX: Use DISTINCT ON instead of MAX() for UUIDs (PostgreSQL doesn't support MAX on UUID)
  unique_threads AS (
    SELECT DISTINCT ON (t_job_id, t_cp_id)
      t_job_id, 
      t_cp_id, 
      t_poster_id, 
      t_acc_id
    FROM thread_participants
    WHERE t_cp_id IS NOT NULL AND t_cp_id != p_user_id
    ORDER BY t_job_id, t_cp_id
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
  WHERE (td.status != 'OPEN') -- Ensure strict adherence to "Show only after hire"
    AND COALESCE(stat.is_deleted, false) = false
  ORDER BY COALESCE(m.created_at, td.job_created_at) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_inbox_summaries(UUID) TO authenticated;

DO $$ BEGIN RAISE NOTICE '✅ Step 6: get_inbox_summaries RPC created'; END $$;

-- ============================================
-- STEP 7: Verification
-- ============================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Check functions exist
    SELECT COUNT(*) INTO v_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name IN (
        'archive_chat', 'unarchive_chat', 'delete_chat',
        'soft_delete_chat_message', 'mark_messages_read',
        'block_user', 'unblock_user', 'check_relationship_status',
        'get_inbox_summaries'
    );
    
    IF v_count = 9 THEN
        RAISE NOTICE '';
        RAISE NOTICE '================================================';
        RAISE NOTICE '✅ CHAT SYSTEM FIX COMPLETE';
        RAISE NOTICE '================================================';
        RAISE NOTICE '';
        RAISE NOTICE 'All 9 functions created successfully:';
        RAISE NOTICE '  • archive_chat';
        RAISE NOTICE '  • unarchive_chat';
        RAISE NOTICE '  • delete_chat';
        RAISE NOTICE '  • soft_delete_chat_message';
        RAISE NOTICE '  • mark_messages_read';
        RAISE NOTICE '  • block_user';
        RAISE NOTICE '  • unblock_user';
        RAISE NOTICE '  • check_relationship_status';
        RAISE NOTICE '  • get_inbox_summaries (CRITICAL for Inbox)';
        RAISE NOTICE '';
        RAISE NOTICE 'Tables verified: chat_states, user_blocks, user_job_visibility';
        RAISE NOTICE 'Trigger updated: trigger_notify_on_chat_message';
        RAISE NOTICE '';
        RAISE NOTICE '================================================';
    ELSE
        RAISE WARNING 'Only % of 9 functions found. Check for errors above.', v_count;
    END IF;
END $$;
