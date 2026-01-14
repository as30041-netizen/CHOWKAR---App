-- DEBUG BIDS VISIBILITY
-- Replace identifiers with values from console log
-- User: 66fcf166-d2c9-4d28-851a-0df5c140db34
-- Job: 1a1fee67-62fd-4a69-9b1d-d2947ee5647e

-- 1. Check if job exists and who owns it
SELECT id, poster_id, title FROM jobs WHERE id = '1a1fee67-62fd-4a69-9b1d-d2947ee5647e';

-- 2. Check if bids exist for this job (ignoring RLS)
SELECT id, worker_id, amount, status FROM bids WHERE job_id = '1a1fee67-62fd-4a69-9b1d-d2947ee5647e';

-- 3. Simulate RLS for the user
-- (Note: Cannot fully simulate auth.uid() in simple SQL editor without setting role, 
-- but we can check the logic of the policy manually)

SELECT * FROM bids 
WHERE job_id = '1a1fee67-62fd-4a69-9b1d-d2947ee5647e'
AND (
    -- Worker Policy
    worker_id = '66fcf166-d2c9-4d28-851a-0df5c140db34'
    OR 
    -- Poster Policy Logic
    job_id IN (SELECT id FROM jobs WHERE poster_id = '66fcf166-d2c9-4d28-851a-0df5c140db34')
);
