-- Test the exact query the frontend is making
SELECT * FROM jobs 
WHERE status = 'OPEN' 
  AND poster_id != '69c95415-770e-4da4-8bf8-25084ace911b'
ORDER BY created_at DESC
LIMIT 20;

-- Check if there are ANY OPEN jobs
SELECT COUNT(*) as open_job_count FROM jobs WHERE status = 'OPEN';
