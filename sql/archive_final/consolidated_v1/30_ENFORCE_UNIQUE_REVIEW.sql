-- ENFORCE UNIQUE REVIEW CONSTRAINT
-- Ensures one review per job per reviewer pair

BEGIN;

DO $$
BEGIN
    -- Drop if exists to avoid conflicts
    ALTER TABLE reviews DROP CONSTRAINT IF EXISTS unique_review_per_job;
    
    -- Add unique constraint
    ALTER TABLE reviews ADD CONSTRAINT unique_review_per_job UNIQUE (reviewer_id, job_id);
    
    RAISE NOTICE 'Unique review constraint enforced.';
EXCEPTION
    WHEN duplicate_table THEN
        RAISE NOTICE 'Constraint already exists.';
END $$;

COMMIT;
