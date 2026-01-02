-- AUTO-ARCHIVE CHATS WHEN JOB COMPLETES
-- Run this in Supabase SQL Editor

-- Function to auto-archive chats when job status changes to COMPLETED
CREATE OR REPLACE FUNCTION auto_archive_completed_job_chat()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed TO completed
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    -- Find all chat participants for this job
    INSERT INTO chats (
      job_id,
      user1_id,
      user2_id,
      user1_archived,
      user2_archived,
      created_at,
      updated_at
    )
    SELECT 
      NEW.id,
      LEAST(NEW.poster_id, COALESCE(b.worker_id, NEW.poster_id)),
      GREATEST(NEW.poster_id, COALESCE(b.worker_id, NEW.poster_id)),
      TRUE, -- Archive for both users
      TRUE,
      NOW(),
      NOW()
    FROM jobs j
    LEFT JOIN bids b ON b.job_id = j.id AND b.status = 'ACCEPTED'
    WHERE j.id = NEW.id
    ON CONFLICT (job_id, user1_id, user2_id) 
    DO UPDATE SET 
      user1_archived = TRUE,
      user2_archived = TRUE,
      updated_at = NOW();
    
    -- Log for debugging
    RAISE NOTICE 'Auto-archived chat for completed job: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_archive_completed_chat ON jobs;
CREATE TRIGGER trigger_auto_archive_completed_chat
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_archive_completed_job_chat();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION auto_archive_completed_job_chat() TO authenticated;
