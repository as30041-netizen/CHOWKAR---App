-- ============================================
-- FIX NOTIFICATIONS AND SECURITY V5
-- 1. Precise Negotiation Notifications (Handles "Agreed" state)
-- 2. Critical Security Fix for Notifications RLS
-- ============================================

-- 1. Refined Negotiation Notification Trigger
CREATE OR REPLACE FUNCTION notify_on_counter_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_title TEXT;
  v_poster_id UUID;
  v_last_entry JSONB;
  v_last_negotiator TEXT;
  v_is_agreed BOOLEAN;
  v_amount_changed BOOLEAN;
BEGIN
  -- 1. Check if it's an update worth notifying (amount or history length changed)
  v_amount_changed := (NEW.amount != OLD.amount) OR 
                      (jsonb_array_length(NEW.negotiation_history) != jsonb_array_length(OLD.negotiation_history));
  
  IF v_amount_changed AND NEW.status = 'PENDING' THEN
    -- 2. Get Job Info
    SELECT title, poster_id INTO v_job_title, v_poster_id FROM jobs WHERE id = NEW.job_id;
    
    -- 3. Get details of the last entry
    v_last_entry := NEW.negotiation_history->-1;
    v_last_negotiator := v_last_entry->>'by';
    v_is_agreed := (v_last_entry->>'agreed')::BOOLEAN;
    
    IF v_last_negotiator = 'WORKER' THEN
      IF v_is_agreed THEN
          -- Worker agreed to terms -> Notify Poster
          INSERT INTO notifications (user_id, type, title, message, related_job_id)
          VALUES (v_poster_id, 'SUCCESS', 'Worker Ready! 🤝', 'Worker agreed to your terms for "' || v_job_title || '". Accept bid to finalize!', NEW.job_id);
      ELSE
          -- Worker countered -> Notify Poster
          INSERT INTO notifications (user_id, type, title, message, related_job_id)
          VALUES (v_poster_id, 'INFO', 'Counter Received! 💬', 'Worker proposed ₹' || NEW.amount || ' for "' || v_job_title || '"', NEW.job_id);
      END IF;
    ELSIF v_last_negotiator = 'POSTER' THEN
      -- Poster countered -> Notify Worker
      INSERT INTO notifications (user_id, type, title, message, related_job_id)
      VALUES (NEW.worker_id, 'INFO', 'New Offer! 💬', 'Employer offered ₹' || NEW.amount || ' for "' || v_job_title || '"', NEW.job_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. CRITICAL SECURITY FIX: Notifications RLS
-- Idempotent Policy Creation
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can only see their own notifications" ON notifications;

CREATE POLICY "Users can only see their own notifications" 
ON notifications FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- 3. Ensure Inbox parity for bid notifications
-- This ensures that bid-related notifications also mark as read when chat is opened
CREATE OR REPLACE FUNCTION mark_messages_read(
  p_job_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Mark ALL notifications for this job as read for the user
    UPDATE notifications
    SET read = TRUE, updated_at = NOW()
    WHERE user_id = auth.uid()
      AND related_job_id = p_job_id
      AND read = FALSE;
    
    -- Also mark actual chat messages as read
    UPDATE chat_messages
    SET read = TRUE, read_at = NOW()
    WHERE job_id = p_job_id
      AND receiver_id = auth.uid()
      AND read = FALSE;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ Notification triggers and Security applied successfully';
END $$;
