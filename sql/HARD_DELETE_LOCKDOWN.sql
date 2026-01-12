-- ============================================================================
-- 🛡️ CHOWKAR DATA INTEGRITY LOCKDOWN: PREVENT HARD DELETES
-- 1. Creates missing soft-delete RPCs.
-- 2. Removes hard-delete permissions from all critical tables.
-- 3. Ensures the database is technically incapable of "forgetting" data.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. MISSING RPCS DEFINITION
-- ----------------------------------------------------------------------------

-- A. Clear notifications for a specific job (Soft Delete)
DROP FUNCTION IF EXISTS soft_delete_job_notifications(UUID);
CREATE OR REPLACE FUNCTION soft_delete_job_notifications(p_job_id UUID)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    UPDATE notifications 
    SET read = TRUE, updated_at = NOW() 
    WHERE related_job_id = p_job_id 
      AND user_id = auth.uid();
    
    RAISE NOTICE '✅ Soft-deleted notifications for job %', p_job_id;
END;
$$;

-- B. Single notification soft delete (Ensuring it exists and is robust)
DROP FUNCTION IF EXISTS soft_delete_notification(UUID);
CREATE OR REPLACE FUNCTION soft_delete_notification(p_notification_id UUID)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    UPDATE notifications 
    SET read = TRUE, updated_at = NOW() 
    WHERE id = p_notification_id 
      AND user_id = auth.uid();
    
    RAISE NOTICE '✅ Notification % marked as read (soft-hide)', p_notification_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION soft_delete_job_notifications(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_notification(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. RLS LOCKDOWN (The "Shield")
-- ----------------------------------------------------------------------------

-- A. JOBS: Remove Delete Access
DROP POLICY IF EXISTS "Users can delete own jobs" ON jobs;
-- We've already added a "Users cannot see their own hidden jobs" policy in the previous script.

-- B. BIDS: Remove Delete Access
-- Workers should never "Delete" a bid, only "Withdraw" (Update status to REJECTED)
DROP POLICY IF EXISTS "Users can delete own bids" ON bids;
DROP POLICY IF EXISTS "Workers can delete their own bids" ON bids;

-- C. NOTIFICATIONS: Remove Delete Access
-- Users should never "Delete", only "Mark as read"
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- Add a select policy if missing
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
FOR SELECT USING (user_id = auth.uid());

-- D. CHAT MESSAGES: No Delete
DROP POLICY IF EXISTS "Users can delete own messages" ON chat_messages;
-- Only UPDATE is allowed for soft-delete (is_deleted = true)

-- E. CHAT STATES: No Delete
-- States are per-user, we only ever want to INSERT or UPDATE the archived/deleted flag.
DROP POLICY IF EXISTS "Users can manage their own chat states" ON chat_states;
CREATE POLICY "Users can view and update their own chat states" ON chat_states
FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own chat states" ON chat_states
FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own chat states" ON chat_states
FOR UPDATE USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. FINAL AUDIT TRAIL TRIGGER (Optional but good for BI)
-- ----------------------------------------------------------------------------
-- Add updated_at to user_job_visibility if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_job_visibility' AND column_name='updated_at') THEN
        ALTER TABLE user_job_visibility ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

COMMIT;
