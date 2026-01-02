-- CHAT ENHANCEMENTS: Read Receipts, Archive/Delete, Voice Notes
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. READ RECEIPTS
-- ============================================

-- Add read tracking columns
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
-- 2. VOICE NOTES & MEDIA
-- ============================================

-- Add media support columns
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('voice', 'image', 'video'));
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_duration INTEGER; -- Duration in seconds for voice/video

-- ============================================
-- 3. ARCHIVE & DELETE CHATS
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

-- Function to delete a chat (soft delete - hides messages before timestamp)
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
-- 4. STORAGE SETUP INSTRUCTIONS
-- ============================================

-- NOTE: Create Storage Bucket via Supabase Dashboard
-- Bucket Name: voice-notes
-- Public: false
-- File Size Limit: 5MB
-- Allowed MIME types: audio/webm, audio/mp4, audio/mpeg, audio/ogg

-- Storage Policy for voice-notes bucket (Run after creating bucket):
-- CREATE POLICY "Users can upload voice notes"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);
-- 
-- CREATE POLICY "Users can read voice notes"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'voice-notes');
