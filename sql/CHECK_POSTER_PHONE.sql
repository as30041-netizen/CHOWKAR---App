-- CHECK: Does the jobs table have poster_phone and is it populated for the test job?
SELECT 
  id,
  title,
  poster_name,
  poster_phone,
  status
FROM jobs
WHERE title = 'Kaam krne wali chaiye';

-- Also check what columns exist on jobs table related to phone
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name LIKE '%phone%';
