
BEGIN;

-- ===================================================
-- FIX: FINISH JOB BUTTON & NOTIFICATIONS PERMISSIONS
-- ===================================================

-- 1. NOTIFICATIONS: Allow authenticated users to create notifications
-- (Required for replyToCounter, withdrawBid, etc. to notify other parties manually)
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
CREATE POLICY "Users can create notifications" ON notifications
FOR INSERT TO authenticated
WITH CHECK (true); 
-- Note:Ideally we check sender_id, but notifications often don't store sender_id (only user_id=recipient).

-- 2. ROBUST JOB COMPLETION TRIGGER
-- Ensure failure to notify doesn't block the job completion transaction
CREATE OR REPLACE FUNCTION notify_on_job_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID;
  v_bid_amount INTEGER;
BEGIN
    BEGIN
        IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
            SELECT worker_id, amount INTO v_worker_id, v_bid_amount
            FROM bids WHERE id = NEW.accepted_bid_id;

            IF v_worker_id IS NOT NULL THEN
                 INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
                 VALUES (
                    v_worker_id, 
                    'SUCCESS', 
                    'Job Completed! 💰', 
                    'Payment of ₹' || COALESCE(v_bid_amount, 0) || ' has been processed.', 
                    NEW.id, 
                    false, 
                    NOW()
                 );
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Job Completion Notification Failed: %', SQLERRM;
        -- Do NOT raise exception, allow job status update to persist
    END;
    RETURN NEW;
END;
$$;

-- 3. ENSURE JOBS RLS IS CORRECT
-- Explicitly re-apply update policy for posters
DROP POLICY IF EXISTS "Posters can update own jobs" ON jobs;
CREATE POLICY "Posters can update own jobs" ON jobs
FOR UPDATE TO authenticated
USING (auth.uid() = poster_id);

COMMIT;
