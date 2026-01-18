-- ============================================
-- TEST CHAT & NOTIFICATION SYNC (End-to-End)
-- ============================================
-- This script simulates a real user sending a message and
-- verifies that the notification system automatically picks it up.
-- ============================================

DO $$
DECLARE
    v_job_id UUID;
    v_poster_id UUID;
    v_worker_id UUID;
    v_msg_id UUID;
    v_notif_count INT;
    v_notif_data RECORD;
BEGIN
    RAISE NOTICE '1. Searching for active job...';
    
    -- Find a real Job with an Accepted Bidder
    SELECT j.id, j.poster_id, b.worker_id 
    INTO v_job_id, v_poster_id, v_worker_id
    FROM jobs j
    JOIN bids b ON b.id = j.accepted_bid_id
    WHERE j.status = 'IN_PROGRESS'
    LIMIT 1;

    IF v_job_id IS NULL THEN
        RAISE NOTICE '❌ No IN_PROGRESS job found to test. Cannot verify sync.';
        RETURN;
    END IF;

    RAISE NOTICE '   Found Job: %', v_job_id;
    RAISE NOTICE '   Poster: %', v_poster_id;
    RAISE NOTICE '   Worker: %', v_worker_id;

    -- 2. Simulate Sending Message (Poster -> Worker)
    RAISE NOTICE '2. Inserting Test Message (Poster -> Worker)...';
    
    INSERT INTO chat_messages (job_id, sender_id, receiver_id, text)
    VALUES (v_job_id, v_poster_id, v_worker_id, 'SYNC_TEST_' || floor(random() * 1000)::text)
    RETURNING id INTO v_msg_id;
    
    RAISE NOTICE '   Message Created: %', v_msg_id;

    -- 3. Verify Notification Trigger
    RAISE NOTICE '3. Checking Notifications Table...';
    
    -- Check if notification exists for this job in the last 5 seconds
    SELECT * INTO v_notif_data
    FROM notifications
    WHERE related_job_id = v_job_id 
      AND user_id = v_worker_id
      AND created_at > (NOW() - INTERVAL '5 seconds')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_notif_data.id IS NOT NULL THEN
        RAISE NOTICE '✅ SUCCESS: Notification Found!';
        RAISE NOTICE '   ID: %', v_notif_data.id;
        RAISE NOTICE '   Message: %', v_notif_data.message;
        RAISE NOTICE '   User: % (Worker)', v_notif_data.user_id;
        RAISE NOTICE '-----------------------------------------------';
        RAISE NOTICE 'CONCLUSION: Chat -> Notification Sync is WORKING.';
        RAISE NOTICE '-----------------------------------------------';
    ELSE
        RAISE NOTICE '❌ FAILURE: Message created but Notification NOT found.';
        RAISE NOTICE '   Trigger [trg_notify_on_chat_message] might be failing or disabled.';
    END IF;

END $$;
