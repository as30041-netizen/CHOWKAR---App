-- FIX EXISTING BIDS WITH INCORRECT NEGOTIATION HISTORY
-- Fresh bids should have NULL/empty negotiation_history

-- Option 1: Clear negotiation_history for bids that only have the initial entry
-- (bids where we accidentally added the initial amount as a negotiation)
UPDATE bids
SET negotiation_history = '[]'
WHERE status = 'PENDING'
  AND jsonb_array_length(negotiation_history::jsonb) = 1
  AND NOT (negotiation_history @> '[{"agreed": true}]');  -- Don't clear agreed bids

-- Verify
SELECT 
  id,
  worker_name,
  amount,
  status,
  negotiation_history,
  jsonb_array_length(negotiation_history::jsonb) as history_count
FROM bids
WHERE status = 'PENDING'
ORDER BY created_at DESC
LIMIT 5;
