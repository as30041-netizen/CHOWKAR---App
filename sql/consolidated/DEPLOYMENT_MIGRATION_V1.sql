-- ============================================================================
-- CHOWKAR DEPLOYMENT MIGRATION V1
-- Consolidates: Account Deletion, optimized feeds, Premium Flow, and Notification Fixes
-- ============================================================================

-- 1. SETUPProcessed Webhooks (Idempotency)
CREATE TABLE IF NOT EXISTS processed_webhooks (
    event_id TEXT PRIMARY KEY,
    payload JSONB,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SAFE DELETE ACCOUNT RPC
CREATE OR REPLACE FUNCTION delete_user_account_safe(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- WIPE PII (Personally Identifiable Information)
    UPDATE profiles
    SET 
        name = 'Deleted User',
        email = NULL,
        phone = NULL,
        photo_url = NULL,
        location = 'N/A',
        push_token = NULL,
        bio = 'This account has been closed.',
        is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Close active jobs
    UPDATE jobs SET status = 'CANCELLED' WHERE poster_id = p_user_id AND status = 'OPEN';
    
    -- Withdraw pending bids
    UPDATE bids SET status = 'REJECTED' WHERE worker_id = p_user_id AND status = 'PENDING';

    RETURN jsonb_build_object('success', true, 'message', 'Account deactivated and PII purged');
END;
$$;

-- 3. OPTIMIZED MY APPLICATIONS FEED RPC
CREATE OR REPLACE FUNCTION get_my_applications_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(t) INTO v_result
    FROM (
        SELECT 
            j.*,
            b.id AS my_bid_id,
            b.status AS my_bid_status,
            b.amount AS my_bid_amount,
            (b.negotiation_history->-1->>'by') AS my_bid_last_negotiation_by,
            (SELECT COUNT(*) FROM bids WHERE job_id = j.id) AS bid_count
        FROM bids b
        JOIN jobs j ON b.job_id = j.id
        LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
        WHERE b.worker_id = p_user_id
          AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
        ORDER BY b.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) t;
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 4. ACTIVATE PREMIUM RPC
CREATE OR REPLACE FUNCTION admin_activate_premium(
    p_event_id TEXT,
    p_user_id UUID,
    p_order_id TEXT,
    p_raw_event JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM processed_webhooks WHERE event_id = p_event_id) THEN
        RETURN json_build_object('success', true, 'message', 'Event already processed', 'idempotent', true);
    END IF;

    UPDATE profiles SET is_premium = true, updated_at = NOW() WHERE id = p_user_id;

    INSERT INTO wallet_transactions (wallet_id, amount, type, description)
    VALUES (p_user_id, 0, 'PURCHASE', 'Premium Upgrade (Order: ' || p_order_id || ')');

    INSERT INTO processed_webhooks (event_id, payload) VALUES (p_event_id, p_raw_event);

    RETURN json_build_object('success', true, 'is_premium', true);
END;
$$;

-- 5. FIXED CHAT/NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION notify_on_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_name TEXT;
  v_job_title TEXT;
BEGIN
  IF NEW.is_deleted THEN RETURN NEW; END IF;

  IF NEW.receiver_id IS NOT NULL THEN
      v_recipient_id := NEW.receiver_id;
  ELSE
      SELECT CASE WHEN NEW.sender_id = j.poster_id THEN b.worker_id ELSE j.poster_id END INTO v_recipient_id
      FROM jobs j LEFT JOIN bids b ON b.id = j.accepted_bid_id WHERE j.id = NEW.job_id;
  END IF;

  IF v_recipient_id IS NULL OR v_recipient_id = NEW.sender_id THEN RETURN NEW; END IF;

  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;

  INSERT INTO notifications (user_id, type, title, message, related_job_id, read)
  VALUES (
    v_recipient_id, 'INFO', COALESCE(v_sender_name, 'Someone') || ' 💬',
    COALESCE('"' || v_job_title || '": ', '') || LEFT(NEW.text, 50),
    NEW.job_id, false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON chat_messages;
CREATE TRIGGER trigger_notify_on_chat_message AFTER INSERT ON chat_messages FOR EACH ROW EXECUTE FUNCTION notify_on_chat_message();
