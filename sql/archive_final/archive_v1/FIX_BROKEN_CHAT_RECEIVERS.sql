-- FIX BROKEN CHAT RECEIVERS
-- Automatically repairs messages where receiver_id is missing or incorrect.
-- Logic: In a 1:1 Job Chat, if Sender is Poster, Receiver is Worker (and vice versa).

DO $$
DECLARE
    r_job RECORD;
    r_msg RECORD;
    v_worker_id UUID;
    v_poster_id UUID;
    v_updates INT := 0;
BEGIN
    -- Loop through all jobs that have an accepted bid (or agreed bid)
    FOR r_job IN 
        SELECT j.id, j.poster_id, b.worker_id 
        FROM jobs j
        JOIN bids b ON (j.accepted_bid_id = b.id OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(b.negotiation_history) h 
            WHERE (h->>'agreed')::boolean = true
        ))
        WHERE j.poster_id IS NOT NULL
    LOOP
        v_poster_id := r_job.poster_id;
        v_worker_id := r_job.worker_id;

        -- Loop through messages in this job
        FOR r_msg IN SELECT id, sender_id, receiver_id FROM chat_messages WHERE job_id = r_job.id
        LOOP
            -- Fix: If Sender is Poster, Receiver MUST be Worker
            IF r_msg.sender_id = v_poster_id AND (r_msg.receiver_id IS NULL OR r_msg.receiver_id != v_worker_id) THEN
                UPDATE chat_messages 
                SET receiver_id = v_worker_id 
                WHERE id = r_msg.id;
                v_updates := v_updates + 1;
            
            -- Fix: If Sender is Worker, Receiver MUST be Poster
            ELSIF r_msg.sender_id = v_worker_id AND (r_msg.receiver_id IS NULL OR r_msg.receiver_id != v_poster_id) THEN
                UPDATE chat_messages 
                SET receiver_id = v_poster_id 
                WHERE id = r_msg.id;
                v_updates := v_updates + 1;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✅ Repaired % chat messages with incorrect receiver_ids.', v_updates;
END $$;
