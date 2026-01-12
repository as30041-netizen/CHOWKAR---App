-- CHECK NEGOTIATION HISTORY FOR RECENT BIDS
-- This will show us what's stored in negotiation_history

SELECT 
  b.id as bid_id,
  j.title,
  b.worker_name,
  b.amount,
  b.status,
  b.negotiation_history,
  jsonb_array_length(b.negotiation_history) as history_count
FROM bids b
JOIN jobs j ON j.id = b.job_id
ORDER BY b.created_at DESC
LIMIT 5;
