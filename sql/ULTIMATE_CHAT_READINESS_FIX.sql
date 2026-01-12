-- ULTIMATE CHAT READINESS FIX

-- 1. NOTIFICATIONS RLS (Essential for the red dot)
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- 2. CHAT MESSAGES RLS (Updated for maximum reliability)
-- Allow participants to see messages where they are either sender OR receiver
DROP POLICY IF EXISTS "Participants can view chat messages" ON chat_messages;
CREATE POLICY "Participants can view chat messages" ON chat_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE id = chat_messages.job_id 
        AND (poster_id = auth.uid() OR accepted_bid_id IN (SELECT id FROM bids WHERE worker_id = auth.uid()))
    )
  );

-- 3. ENSURE POSTER PHONE IS ACCESSIBLE
-- Update the jobs table to ensure poster_phone is never null for accepted jobs
UPDATE jobs SET poster_phone = (SELECT phone FROM profiles WHERE id = jobs.poster_id)
WHERE poster_phone IS NULL OR poster_phone = '';

-- 4. Verify the trigger function is using the correct 'name' column
CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
    v_sender_name TEXT;
    v_job_title TEXT;
BEGIN
    SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
    SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;

    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        related_job_id,
        created_at
    ) VALUES (
        NEW.receiver_id,
        'New Message',
        COALESCE(v_sender_name, 'Someone') || ': ' || LEFT(NEW.text, 50),
        'INFO',
        NEW.job_id,
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  RAISE NOTICE '✅ SQL Readiness Check Complete.';
END $$;
