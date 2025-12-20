-- ============================================================
-- CHAT & NOTIFICATION SYSTEM - COMBINED SQL SCRIPT
-- Run this ENTIRE script in Supabase SQL Editor
-- Date: 2024-12-18
-- ============================================================

-- ============================================
-- SECTION 1: READ RECEIPTS
-- ============================================

-- Add read tracking columns to chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(p_job_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE chat_messages 
  SET read = TRUE, read_at = NOW()
  WHERE job_id = p_job_id 
    AND receiver_id = p_user_id 
    AND read = FALSE
    AND sender_id != p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SECTION 2: VOICE NOTES & MEDIA SUPPORT
-- ============================================

-- Add media support columns
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('voice', 'image', 'video'));
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_duration INTEGER; -- Duration in seconds

-- ============================================
-- SECTION 3: ARCHIVE & DELETE CHATS
-- ============================================

-- Function to archive a chat
CREATE OR REPLACE FUNCTION archive_chat(p_job_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_other_user_id UUID;
BEGIN
  -- Determine the other user in the conversation
  SELECT CASE 
    WHEN j.poster_id = v_user_id THEN COALESCE(b.worker_id, j.poster_id)
    ELSE j.poster_id 
  END INTO v_other_user_id
  FROM jobs j
  LEFT JOIN bids b ON b.job_id = j.id AND b.status = 'ACCEPTED'
  WHERE j.id = p_job_id
  LIMIT 1;

  -- Insert or update chat record
  INSERT INTO chats (
    job_id, 
    user1_id, 
    user2_id, 
    user1_archived,
    user2_archived,
    created_at,
    updated_at
  )
  VALUES (
    p_job_id,
    LEAST(v_user_id, v_other_user_id),
    GREATEST(v_user_id, v_other_user_id),
    CASE WHEN LEAST(v_user_id, v_other_user_id) = v_user_id THEN TRUE ELSE FALSE END,
    CASE WHEN GREATEST(v_user_id, v_other_user_id) = v_user_id THEN TRUE ELSE FALSE END,
    NOW(),
    NOW()
  )
  ON CONFLICT (job_id, user1_id, user2_id) 
  DO UPDATE SET 
    user1_archived = CASE WHEN chats.user1_id = v_user_id THEN TRUE ELSE chats.user1_archived END,
    user2_archived = CASE WHEN chats.user2_id = v_user_id THEN TRUE ELSE chats.user2_archived END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unarchive a chat
CREATE OR REPLACE FUNCTION unarchive_chat(p_job_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  UPDATE chats
  SET 
    user1_archived = CASE WHEN user1_id = v_user_id THEN FALSE ELSE user1_archived END,
    user2_archived = CASE WHEN user2_id = v_user_id THEN FALSE ELSE user2_archived END,
    updated_at = NOW()
  WHERE job_id = p_job_id
    AND (user1_id = v_user_id OR user2_id = v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a chat (soft delete)
CREATE OR REPLACE FUNCTION delete_chat(p_job_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_other_user_id UUID;
BEGIN
  -- Determine the other user
  SELECT CASE 
    WHEN j.poster_id = v_user_id THEN COALESCE(b.worker_id, j.poster_id)
    ELSE j.poster_id 
  END INTO v_other_user_id
  FROM jobs j
  LEFT JOIN bids b ON b.job_id = j.id AND b.status = 'ACCEPTED'
  WHERE j.id = p_job_id
  LIMIT 1;

  -- Insert or update chat record with deleted_until timestamp
  INSERT INTO chats (
    job_id, 
    user1_id, 
    user2_id,
    user1_deleted_until,
    user2_deleted_until,
    created_at,
    updated_at
  )
  VALUES (
    p_job_id,
    LEAST(v_user_id, v_other_user_id),
    GREATEST(v_user_id, v_other_user_id),
    CASE WHEN LEAST(v_user_id, v_other_user_id) = v_user_id THEN NOW() ELSE NULL END,
    CASE WHEN GREATEST(v_user_id, v_other_user_id) = v_user_id THEN NOW() ELSE NULL END,
    NOW(),
    NOW()
  )
  ON CONFLICT (job_id, user1_id, user2_id) 
  DO UPDATE SET 
    user1_deleted_until = CASE WHEN chats.user1_id = v_user_id THEN NOW() ELSE chats.user1_deleted_until END,
    user2_deleted_until = CASE WHEN chats.user2_id = v_user_id THEN NOW() ELSE chats.user2_deleted_until END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SECTION 4: RLS POLICY FIX (406 Errors)
-- ============================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can read messages for their jobs" ON chat_messages;

-- Create better policy that allows reading messages from jobs where user is poster or bidder
CREATE POLICY "Users can read messages for their jobs" ON chat_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = chat_messages.job_id
    AND (
      j.poster_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM bids b
        WHERE b.job_id = j.id
        AND b.worker_id = auth.uid()
      )
    )
  )
);

-- ============================================
-- SECTION 5: AUTO-ARCHIVE ON JOB COMPLETION
-- ============================================

-- Function to auto-archive chats when job status changes to COMPLETED
CREATE OR REPLACE FUNCTION auto_archive_completed_job_chat()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed TO completed
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    -- Find all chat participants for this job
    INSERT INTO chats (
      job_id,
      user1_id,
      user2_id,
      user1_archived,
      user2_archived,
      created_at,
      updated_at
    )
    SELECT 
      NEW.id,
      LEAST(NEW.poster_id, COALESCE(b.worker_id, NEW.poster_id)),
      GREATEST(NEW.poster_id, COALESCE(b.worker_id, NEW.poster_id)),
      TRUE,
      TRUE,
      NOW(),
      NOW()
    FROM jobs j
    LEFT JOIN bids b ON b.job_id = j.id AND b.status = 'ACCEPTED'
    WHERE j.id = NEW.id
    ON CONFLICT (job_id, user1_id, user2_id) 
    DO UPDATE SET 
      user1_archived = TRUE,
      user2_archived = TRUE,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS trigger_auto_archive_completed_chat ON jobs;
CREATE TRIGGER trigger_auto_archive_completed_chat
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_archive_completed_job_chat();

-- ============================================
-- SECTION 6: NOTIFICATION CLEANUP (Optional)
-- ============================================

-- Function to clean old read notifications (7+ days old)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE read = TRUE
  AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SECTION 7: GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION mark_messages_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_chat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unarchive_chat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_chat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_notifications() TO authenticated;

-- ============================================
-- DONE! All SQL changes applied.
-- ============================================
