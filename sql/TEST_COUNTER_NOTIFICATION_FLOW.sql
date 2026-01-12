-- ============================================
-- TEST 'COUNTER OFFER' NOTIFICATION FLOW
-- ============================================
-- 1. Find a PENDING bid
-- 2. Simulate Counter Offer (UPDATE negotiation_history)
-- 3. Verify 'INFO' Notification
-- ============================================

-- A. Setup Test Context (Find a Pending Bid)
CREATE TEMP TABLE IF NOT EXISTS test_counter_setup AS
SELECT 
    b.id as bid_id,
    b.job_id,
    b.worker_id, 
    j.poster_id,
    j.title as job_title,
    b.amount as original_amount,
    b.negotiation_history
FROM bids b
JOIN jobs j ON j.id = b.job_id
WHERE b.status = 'PENDING' 
  AND j.status = 'OPEN'
LIMIT 1;

-- B. Execute Counter Offer (Poster counters Worker)
WITH countered_bid AS (
    UPDATE bids
    SET 
        amount = original_amount + 50,
        negotiation_history = COALESCE(negotiation_history, '[]'::jsonb) || 
            jsonb_build_object(
                'amount', original_amount + 50,
                'by', 'POSTER',
                'timestamp', extract(epoch from now()) * 1000
            )
    WHERE id = (SELECT bid_id FROM test_counter_setup)
    RETURNING id, amount, negotiation_history
)
SELECT 
    '1. Counter Offer Placed' as step,
    id as bid_id,
    amount as new_amount
FROM countered_bid;

-- C. Verify Notification (Worker should receive it)
SELECT 
    '2. Counter Notification' as step,
    n.id as notif_id,
    n.title,
    n.message,
    n.user_id as recipient_worker
FROM notifications n
JOIN test_counter_setup th ON n.related_job_id = th.job_id
WHERE n.user_id = (SELECT worker_id FROM test_counter_setup)
  AND n.title LIKE '%Counter%'
  AND n.created_at > (NOW() - INTERVAL '5 seconds');

-- D. Rollback (Cleanup)
UPDATE bids 
SET 
  amount = (SELECT original_amount FROM test_counter_setup),
  negotiation_history = (SELECT negotiation_history FROM test_counter_setup)
WHERE id = (SELECT bid_id FROM test_counter_setup);

DROP TABLE IF EXISTS test_counter_setup;
