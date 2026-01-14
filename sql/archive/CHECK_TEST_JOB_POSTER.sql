-- CHECK: Who posted the test job "Kaam krne wali chaiye"?
SELECT 
  j.id as job_id,
  j.title,
  j.poster_id,
  j.poster_name,
  j.status,
  j.bid_count,
  p.email as poster_email
FROM jobs j
LEFT JOIN profiles p ON p.id = j.poster_id
WHERE j.title = 'Kaam krne wali chaiye';
