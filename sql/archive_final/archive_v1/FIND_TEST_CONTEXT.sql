-- ============================================
-- FIND VALID TEST CONTEXT
-- ============================================
-- We need a Job with a Poster and a Worker (Accepted Bid) 
-- to simulate a valid chat and notification flow.
-- ============================================

SELECT 
    j.id as job_id,
    j.title,
    j.poster_id,
    j.status,
    b.worker_id,
    b.id as bid_id
FROM jobs j
JOIN bids b ON b.id = j.accepted_bid_id
WHERE j.status = 'IN_PROGRESS'
LIMIT 1;
