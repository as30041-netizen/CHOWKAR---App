-- FIX ALL PENDING BIDS - Clear negotiation_history for fresh bids
-- This will fix Worker B's "Waiting for response" issue

UPDATE bids
SET negotiation_history = '[]'
WHERE status = 'PENDING'
  AND NOT (negotiation_history @> '[{"agreed": true}]');

-- View results
SELECT 
  id,
  worker_name,
  amount,
  status,
  negotiation_history
FROM bids
WHERE status = 'PENDING'
ORDER BY created_at DESC
LIMIT 10;
