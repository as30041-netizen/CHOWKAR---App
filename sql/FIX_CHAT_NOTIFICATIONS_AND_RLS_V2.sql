-- ROBUST CHAT NOTIFICATION & RLS FIX (FIXED COLUMN NAME)

-- 1. Ensure RLS allows both participants to see messages
DROP POLICY IF EXISTS "Participants can view chat messages" ON chat_messages;
CREATE POLICY "Participants can view chat messages" ON chat_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

DROP POLICY IF EXISTS "Participants can insert chat messages" ON chat_messages;
CREATE POLICY "Participants can insert chat messages" ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
  );

-- 2. Create the Chat Notification Function (using 'name' instead of 'full_name')
CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
    v_sender_name TEXT;
    v_job_title TEXT;
BEGIN
    -- Get sender's name (Fixed column name to 'name')
    SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
    
    -- Get job title
    SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;

    -- Insert notification for the receiver
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        related_job_id,
        created_at
    ) VALUES (
        NEW.receiver_id,
        'New Message - ' || COALESCE(v_job_title, 'Job'),
        COALESCE(v_sender_name, 'Someone') || ': ' || LEFT(NEW.text, 50),
        'INFO',
        NEW.job_id,
        NOW()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the Trigger
DROP TRIGGER IF EXISTS trg_notify_on_new_message ON chat_messages;
CREATE TRIGGER trg_notify_on_new_message
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION notify_on_new_message();

-- 4. Enable Realtime Identity
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  RAISE NOTICE '✅ Chat RLS and Notification Trigger have been synchronized with correct column names.';
END $$;
