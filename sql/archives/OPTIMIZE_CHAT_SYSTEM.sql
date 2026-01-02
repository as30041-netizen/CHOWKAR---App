-- ==============================================================================
-- CHAT SYSTEM OPTIMIZATION
-- 1. RPC for efficient Inbox loading (Solves N+1 query problem)
-- 2. Strict RLS for Chat Messages (Prevents data leaks in realtime)
-- ==============================================================================

-- 1. RPC: Fetch Inbox Summaries in ONE request
-- Returns: Job details + Last Message + Counterpart info for all active chats
CREATE OR REPLACE FUNCTION get_inbox_summaries(p_user_id UUID)
RETURNS TABLE (
    job_id UUID,
    job_title TEXT,
    job_status TEXT,
    poster_id UUID,
    accepted_bidder_id UUID, 
    counterpart_id UUID,
    counterpart_name TEXT,
    counterpart_photo TEXT,
    last_message_text TEXT,
    last_message_time TIMESTAMPTZ,
    last_message_sender_id UUID,
    last_message_is_read BOOLEAN,
    unread_count BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH UserChats AS (
        -- Find all jobs where the user is a participant (Poster or Accepted Worker)
        -- AND the job is not in OPEN state (chats only active in IN_PROGRESS/COMPLETED)
        -- OR checks specifically for existing chat_messages to include historical chats?
        -- Let's rely on the 'chats' table or inferred relationships.
        -- Using inferred relationships is safer if 'chats' table logic is flaky.
        
        -- CASE A: User is POSTER
        SELECT 
            j.id as j_id, 
            j.title, 
            j.status, 
            j.poster_id, 
            b.worker_id as accepted_id,
            b.worker_id as other_id
        FROM jobs j
        LEFT JOIN bids b ON b.id = j.accepted_bid_id
        WHERE j.poster_id = p_user_id
        AND j.accepted_bid_id IS NOT NULL -- Chat only exists if there is an accepted worker
        
        UNION ALL
        
        -- CASE B: User is ACCEPTED WORKER
        SELECT 
            j.id as j_id, 
            j.title, 
            j.status, 
            j.poster_id,
            b.worker_id as accepted_id,
            j.poster_id as other_id
        FROM jobs j
        JOIN bids b ON b.id = j.accepted_bid_id
        WHERE b.worker_id = p_user_id
    ),
    LastMessages AS (
        -- Efficiently get the last message for each job using DISTINCT ON
        SELECT DISTINCT ON (m.job_id)
            m.job_id,
            m.text,
            m.created_at,
            m.sender_id,
            m.read
        FROM chat_messages m
        WHERE m.job_id IN (SELECT j_id FROM UserChats)
        ORDER BY m.job_id, m.created_at DESC
    ),
    UnreadCounts AS (
        SELECT 
            n.related_job_id,
            COUNT(*) as count
        FROM notifications n
        WHERE n.user_id = p_user_id
        AND n.read = false
        GROUP BY n.related_job_id
    )
    SELECT 
        uc.j_id,
        uc.title,
        uc.status,
        uc.poster_id,
        uc.accepted_id,
        uc.other_id,
        p.name as counterpart_name,
        p.profile_photo as counterpart_photo,
        lm.text,
        lm.created_at,
        lm.sender_id,
        lm.read,
        COALESCE(un.count, 0)
    FROM UserChats uc
    JOIN profiles p ON p.id = uc.other_id
    LEFT JOIN LastMessages lm ON lm.job_id = uc.j_id
    LEFT JOIN UnreadCounts un ON un.related_job_id = uc.j_id
    -- Order by latest message time, fallback to job creation? 
    -- We don't have job creation here, so just last Msg.
    -- If no message (brand new match), put at top or bottom?
    -- Let's sort nulls last.
    ORDER BY lm.created_at DESC NULLS FIRST;
END;
$$;


-- 2. SECURITY: Strict RLS for Chat Messages
-- Ensure users can ONLY access messages they are part of.
-- Note: 'chat_messages' likely already has RLS, but let's reinforce it.

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see messages they sent or received OR are job participant" ON chat_messages;

CREATE POLICY "Users can see messages they sent or received OR are job participant"
ON chat_messages FOR SELECT
USING (
    sender_id = auth.uid() 
    OR 
    receiver_id = auth.uid()
    OR
    EXISTS (
        -- User is the POSTER of the job
        SELECT 1 FROM jobs j 
        WHERE j.id = chat_messages.job_id 
        AND j.poster_id = auth.uid()
    )
    OR
    EXISTS (
        -- User is the ACCEPTED WORKER of the job
        SELECT 1 FROM jobs j
        JOIN bids b ON b.id = j.accepted_bid_id
        WHERE j.id = chat_messages.job_id
        AND b.worker_id = auth.uid()
    )
);

-- Notify user of completion
SELECT 'Chat optimization functions created successfully' as status;
