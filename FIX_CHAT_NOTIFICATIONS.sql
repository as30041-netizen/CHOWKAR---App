-- FIX CHAT NOTIFICATIONS (Backend Trigger)
-- This ensures notifications are created even if the user is offline.

-- 1. Create the Trigger Function
CREATE OR REPLACE FUNCTION handle_new_chat_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into notifications table
  -- Targeted at the RECEIVER (new.receiver_id)
  -- Sender (auth.uid or new.sender_id) is NOT notified
  
  INSERT INTO notifications (user_id, title, message, type, related_job_id, read)
  VALUES (
    NEW.receiver_id,
    'New Message',
    CASE 
      WHEN LENGTH(NEW.text) > 50 THEN SUBSTRING(NEW.text FROM 1 FOR 50) || '...'
      ELSE NEW.text 
    END,
    'INFO',
    NEW.job_id,
    FALSE
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the Trigger
DROP TRIGGER IF EXISTS on_chat_message_created ON chat_messages;

CREATE TRIGGER on_chat_message_created
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_chat_message();

-- 3. Verify Notifications Table Policies (ensure Server execution works)
-- Triggers run with SECURITY DEFINER (owner privileges), so RLS usually bypassed for the function internals.
