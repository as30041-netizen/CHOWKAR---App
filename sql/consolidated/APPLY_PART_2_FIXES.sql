-- ========================================================
-- MASTER RELIABILITY FIX SCRIPT - PART 2
-- Combines: Auto-Receiver Trigger and Secure Chat Deletion View
-- ========================================================

-- ========================================================
-- PART 1: AUTO-FIX RECEIVER ID TRIGGER
-- Ensures that every new chat message has a valid receiver_id.
-- ========================================================

CREATE OR REPLACE FUNCTION ensure_chat_receiver()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_poster_id UUID;
    v_worker_id UUID;
    v_accepted_bid_id UUID;
BEGIN
    -- Get Job Details
    SELECT poster_id, accepted_bid_id INTO v_poster_id, v_accepted_bid_id
    FROM jobs WHERE id = NEW.job_id;

    -- Get Worker ID (from accepted bid or agreed negotiation)
    IF v_accepted_bid_id IS NOT NULL THEN
        SELECT worker_id INTO v_worker_id FROM bids WHERE id = v_accepted_bid_id;
    ELSE
        -- Fallback: Check for agreed bid
        SELECT worker_id INTO v_worker_id
        FROM bids 
        WHERE job_id = NEW.job_id 
        AND (
            EXISTS (SELECT 1 FROM jsonb_array_elements(negotiation_history) h WHERE (h->>'agreed')::boolean = true)
        )
        LIMIT 1;
    END IF;

    -- Logic: Provide missing receiver_id
    IF NEW.sender_id = v_poster_id THEN
        NEW.receiver_id := v_worker_id; -- Poster -> Worker
    ELSIF NEW.sender_id = v_worker_id THEN
        NEW.receiver_id := v_poster_id; -- Worker -> Poster
    END IF;

    -- Safety: If we still don't have a receiver, and we are not the poster, assume poster is receiver
    IF NEW.receiver_id IS NULL AND NEW.sender_id != v_poster_id THEN
        NEW.receiver_id := v_poster_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_ensure_chat_receiver ON chat_messages;

CREATE TRIGGER trigger_ensure_chat_receiver
    BEFORE INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION ensure_chat_receiver();

DO $$
BEGIN
    RAISE NOTICE '✅ Auto-Receiver Trigger Installed.';
END $$;


-- ============================================
-- PART 2: FIX CHAT DELETE LOGIC & SECURE VIEW
-- Updates soft_delete to preserve text, and creates view to mask it.
-- ============================================

-- 2.1 Update Soft Delete Function
CREATE OR REPLACE FUNCTION soft_delete_chat_message(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Soft delete: Mark as deleted, BUT DO NOT OVERWRITE TEXT
    -- This allows analytics to still see what was written
    UPDATE chat_messages
    SET 
        is_deleted = TRUE
    WHERE id = p_message_id 
      AND sender_id = auth.uid();  -- Only sender can delete their own message
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found or you are not the sender';
    END IF;
    
    RAISE NOTICE '✅ Message soft-deleted (Data preserved): %', p_message_id;
END;
$$;

-- 2.15 Ensure Media Columns Exist (Schema Drift Fix)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'media_type') THEN
        ALTER TABLE chat_messages ADD COLUMN media_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'media_url') THEN
        ALTER TABLE chat_messages ADD COLUMN media_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'media_duration') THEN
        ALTER TABLE chat_messages ADD COLUMN media_duration INTEGER;
    END IF;
END $$;

-- 2.2 Create Secure View
DROP VIEW IF EXISTS view_chat_messages;

CREATE VIEW view_chat_messages AS
SELECT
  id,
  job_id,
  sender_id,
  receiver_id,
  -- MASKING LOGIC: If deleted, hide the text
  CASE 
    WHEN is_deleted THEN '🚫 This message was deleted'
    ELSE text 
  END AS text,
  translated_text,
  created_at,
  read,
  read_at,
  is_deleted,
  media_type,
  media_url,
  media_duration
FROM chat_messages;

-- Grant access to the view
GRANT SELECT ON view_chat_messages TO authenticated;

DO $$
BEGIN
    RAISE NOTICE '✅ Soft delete function updated to preserve data.';
    RAISE NOTICE '✅ Secure View `view_chat_messages` created.';
END $$;
