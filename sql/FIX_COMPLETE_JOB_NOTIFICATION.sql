-- ============================================
-- FIX: NOTIFY WORKER ON JOB COMPLETION
-- ============================================

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION notify_worker_on_job_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if status changed to COMPLETED
    IF OLD.status != 'COMPLETED' AND NEW.status = 'COMPLETED' AND NEW.accepted_bid_id IS NOT NULL THEN
        
        -- Get worker ID from the accepted bid
        DECLARE
            v_worker_id UUID;
        BEGIN
            SELECT worker_id INTO v_worker_id
            FROM bids
            WHERE id = NEW.accepted_bid_id;

            -- Insert notification for the worker
            IF v_worker_id IS NOT NULL THEN
                INSERT INTO notifications (user_id, title, message, type, related_job_id)
                VALUES (
                    v_worker_id,
                    'Job Completed!',
                    'The job "' || NEW.title || '" has been marked as completed. Please leave a review.',
                    'SUCCESS',
                    NEW.id
                );
            END IF;
        END;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS on_job_complete_notify ON jobs;

CREATE TRIGGER on_job_complete_notify
AFTER UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION notify_worker_on_job_completion();
