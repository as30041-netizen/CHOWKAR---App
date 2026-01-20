-- ============================================================================
-- TEST_PUSH_CHAIN.sql
-- ============================================================================
-- Run this to verify if the Push Notification Pipeline is working.
-- It forcibly inserts a message and checks the logs.
-- ============================================================================

DO $$
DECLARE
    v_job_id UUID;
    v_poster_id UUID;
    v_worker_id UUID;
    v_msg_id UUID;
BEGIN
    -- 1. Find a valid Job with an Accepted Bid (Poster <-> Worker relationship)
    SELECT j.id, j.poster_id, b.worker_id 
    INTO v_job_id, v_poster_id, v_worker_id
    FROM jobs j
    JOIN bids b ON b.id = j.accepted_bid_id
    WHERE j.status = 'IN_PROGRESS'
    LIMIT 1;

    IF v_job_id IS NULL THEN
        RAISE NOTICE '❌ No IN_PROGRESS job found to test. Trying to find ANY job with a bid...';
         SELECT j.id, j.poster_id, b.worker_id 
         INTO v_job_id, v_poster_id, v_worker_id
         FROM jobs j
         JOIN bids b ON b.job_id = j.id
         WHERE j.status = 'OPEN'
         LIMIT 1;
    END IF;

    IF v_job_id IS NULL THEN
        RAISE EXCEPTION '❌ Could not find any valid Job/Bid pair to test. Please create a job and bid first.';
    END IF;

    RAISE NOTICE '🧪 Testing with Job: %, Sender(Worker): %, Receiver(Poster): %', v_job_id, v_worker_id, v_poster_id;

    -- 2. Simulate User Sending a Message (Worker connects to Poster)
    -- We use a known ID to verify insertion
    v_msg_id := gen_random_uuid();

    INSERT INTO chat_messages (id, job_id, sender_id, receiver_id, text, created_at)
    VALUES (
        v_msg_id, 
        v_job_id, 
        v_worker_id, 
        v_poster_id, 
        '🔥 TEST PUSH NOTIFICATION: ' || now(), 
        now()
    );

    RAISE NOTICE '✅ Message Inserted (ID: %). Check logs below.', v_msg_id;
END;
$$;

-- 3. VIEW THE LOGS
-- This will show if the Triggers fired successfully
SELECT * FROM push_debug_logs ORDER BY created_at DESC LIMIT 10;
