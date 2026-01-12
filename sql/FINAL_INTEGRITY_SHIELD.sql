-- ============================================================================
-- 🛡️ CHOWKAR DATA INTEGRITY FINAL SHIELD: NO DATA LEFT BEHIND
-- 1. Converts all REMAINING hard-delete RPCs to Soft-Deletes.
-- 2. Standardizes behavior for Notifications, Bids, and Chats.
-- 3. Technially blocks all HARD DELETE operations on core tables.
-- ============================================================================

BEGIN;

-- 1. NOTIFICATIONS: SOFT-CLEAR ALL
DROP FUNCTION IF EXISTS clear_all_notifications();
CREATE OR REPLACE FUNCTION clear_all_notifications()
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Instead of deleting, we mark all as read. 
    -- This keeps the history for the user's "Activity Log" in the future.
    UPDATE notifications 
    SET read = TRUE, updated_at = NOW() 
    WHERE user_id = auth.uid();
    
    RAISE NOTICE '✅ All notifications marked read (Soft Cleared) for user %', auth.uid();
END;
$$;

-- 2. BIDS: SOFT-WITHDRAW
DROP FUNCTION IF EXISTS withdraw_from_job(UUID, UUID);
CREATE OR REPLACE FUNCTION withdraw_from_job(
  p_job_id UUID,
  p_bid_id UUID
)
RETURNS JSON 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_bid RECORD;
BEGIN
    -- Get bid
    SELECT * INTO v_bid FROM bids 
    WHERE id = p_bid_id AND worker_id = auth.uid();
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Bid not found or you are not the worker';
    END IF;
    
    -- SOFT WITHDRAWAL: Change status to REJECTED (acting as withdrawn)
    UPDATE bids 
    SET status = 'REJECTED', updated_at = NOW() 
    WHERE id = p_bid_id;
    
    RETURN json_build_object(
      'success', true,
      'message', 'Bid withdrawn successfully (Status: REJECTED)'
    );
END;
$$;

-- 3. CHAT: SOFT-DELETE (Using chat_states)
DROP FUNCTION IF EXISTS delete_chat(UUID);
CREATE OR REPLACE FUNCTION delete_chat(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Soft delete: Mark as deleted for THIS user only in chat_states
    -- This ensures the other participant can still see the messages
    INSERT INTO chat_states (user_id, job_id, is_deleted, updated_at)
    VALUES (auth.uid(), p_job_id, TRUE, NOW())
    ON CONFLICT (user_id, job_id) 
    DO UPDATE SET is_deleted = TRUE, updated_at = NOW();
    
    RAISE NOTICE '✅ Chat hidden/soft-deleted for job % by user %', p_job_id, auth.uid();
END;
$$;

-- 4. PERMISSIONS & GRANTS
GRANT EXECUTE ON FUNCTION clear_all_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION withdraw_from_job(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_chat(UUID) TO authenticated;

-- 5. THE ULTIMATE SHIELD: DISABLE HARD DELETE ON CORE TABLES
-- This prevents ANY direct .delete() calls from working
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Remove any existing DELETE policies
DROP POLICY IF EXISTS "Users can delete own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can delete own bids" ON bids;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own messages" ON chat_messages;
DROP POLICY IF EXISTS "Workers can delete their own bids" ON bids;

-- (Optional) If you want to be 100% sure, you can also add a policy that explicitly rejects deletes
-- But usually, having NO policy for DELETE means DELETE is denied for non-owners/non-admins.

COMMIT;
