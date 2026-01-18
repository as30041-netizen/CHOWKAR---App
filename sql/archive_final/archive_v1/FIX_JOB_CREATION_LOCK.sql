
-- 1. DROP POTENTIALLY PROBLEMATIC TRIGGERS ON JOBS
-- We only need triggers that handle job status changes or essential syncs. 
-- Self-notification triggers on INSERT are redundant and can cause locks.

DROP TRIGGER IF EXISTS on_job_created ON jobs;
DROP TRIGGER IF EXISTS on_job_status_change ON jobs;
DROP TRIGGER IF EXISTS on_job_completion_notify ON jobs;

-- 2. ENSURE RLS POLICIES FOR INSERT ARE CORRECT
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create their own jobs" ON jobs;
CREATE POLICY "Users can create their own jobs"
ON jobs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Posters can update their own jobs" ON jobs;
CREATE POLICY "Posters can update their own jobs"
ON jobs FOR UPDATE
TO authenticated
USING (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Everyone can view jobs" ON jobs;
CREATE POLICY "Everyone can view jobs"
ON jobs FOR SELECT
TO authenticated
USING (true);

-- 3. RE-CREATE ESSENTIAL NOTIFICATION TRIGGER (Optimized)
-- Only notify WORKERS when a job they bid on is updated/completed.
-- Do NOT notify the poster about their own actions via Trigger (Frontend handles that).

CREATE OR REPLACE FUNCTION notify_workers_on_job_update()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only proceed if status changed to COMPLETED or CANCELLED
    IF (OLD.status != NEW.status AND (NEW.status = 'COMPLETED' OR NEW.status = 'CANCELLED')) THEN
        
        -- Notify Accepted Worker
        IF (NEW.accepted_bid_id IS NOT NULL) THEN
            INSERT INTO notifications (user_id, title, message, type, related_job_id)
            SELECT 
                worker_id,
                CASE 
                    WHEN NEW.status = 'COMPLETED' THEN 'Job Completed! 🎉'
                    ELSE 'Job Cancelled'
                END,
                CASE 
                    WHEN NEW.status = 'COMPLETED' THEN 'The job "' || NEW.title || '" has been marked as complete.'
                    ELSE 'The job "' || NEW.title || '" has been cancelled.'
                END,
                CASE 
                    WHEN NEW.status = 'COMPLETED' THEN 'SUCCESS'
                    ELSE 'WARNING'
                END,
                NEW.id
            FROM bids
            WHERE id = NEW.accepted_bid_id;
        END IF;

    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_job_status_change
AFTER UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION notify_workers_on_job_update();

-- 4. VERIFY JOBS TABLE COLUMNS (Sanity Check)
-- Ensure 'image' column exists as text (for base64/url)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'image') THEN
        ALTER TABLE jobs ADD COLUMN image TEXT;
    END IF;
END $$;
