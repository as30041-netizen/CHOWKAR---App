-- ============================================
-- DIAGNOSE COUNTER OFFER DATA
-- ============================================
-- Check what's actually stored in negotiation_history

-- Find recent bids with negotiation history
SELECT 
  b.id as bid_id,
  b.worker_id,
  b.amount,
  b.status,
  j.title as job_title,
  j.poster_id,
  b.negotiation_history,
  -- Extract the last negotiation entry
  b.negotiation_history::jsonb->-1 as last_entry,
  -- Extract the 'by' field from last entry
  b.negotiation_history::jsonb->-1->>'by' as last_negotiator,
  -- Count history entries
  jsonb_array_length(b.negotiation_history::jsonb) as history_count
FROM bids b
JOIN jobs j ON b.job_id = j.id
WHERE b.negotiation_history IS NOT NULL
  AND jsonb_array_length(b.negotiation_history::jsonb) > 0
  AND b.created_at > NOW() - INTERVAL '1 hour'  -- Recent bids only
ORDER BY b.updated_at DESC
LIMIT 10;

-- Check if there are notifications being created
SELECT 
  n.id,
  n.user_id,
  n.title,
  n.message,
  n.created_at,
  p.name as recipient_name
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.title LIKE '%Counter%'
  AND n.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY n.created_at DESC
LIMIT 20;
