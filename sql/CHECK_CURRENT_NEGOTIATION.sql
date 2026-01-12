-- CHECK NEGOTIATION STATE FOR THE TEST JOB
SELECT 
  j.id,
  j.title,
  j.status,
  b.id as bid_id,
  b.worker_name,
  b.amount,
  b.status as bid_status,
  b.negotiation_history,
  (b.negotiation_history -> -1 ->> 'by') as last_negotiator
FROM jobs j
JOIN bids b ON b.job_id = j.id
WHERE j.title = 'Kaam krne wali chaiye'
ORDER BY b.created_at DESC;
