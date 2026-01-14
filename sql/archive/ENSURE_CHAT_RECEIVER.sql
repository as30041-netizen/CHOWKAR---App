-- AUTO-FIX RECEIVER ID TRIGGER
-- Ensures that every new chat message has a valid receiver_id.
-- If receiver_id is NULL or incorrect, this trigger fixes it BEFORE INSERT.

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
