-- ============================================
-- FIX CHAT SYNC, RLS AND SCHEMA V7 (REVISED)
-- 1. Add missing receiver_id column
-- 2. Correct RLS for Handshake Phase (ALLOW AGREED BIDDERS)
-- 3. Add Missing INSERT policy for Chat Messages
-- 4. Fix get_inbox_summaries once more for consistency
-- ============================================

-- 1. Ensure schema has the necessary columns
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id);

-- 2. Ensure RLS is active
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 3. Clean up old policies
DROP POLICY IF EXISTS "Users can see messages they sent or received OR are job participant" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON chat_messages;

-- 4. Create Robust SELECT Policy (Accounts for Handshake/Agreed stage)
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
        -- User is a bid participant who has AGREED or been ACCEPTED
        SELECT 1 FROM bids b
        WHERE b.job_id = chat_messages.job_id
        AND b.worker_id = auth.uid()
        AND (
            -- Either I am officially hired
            EXISTS (SELECT 1 FROM jobs j WHERE j.id = b.job_id AND j.accepted_bid_id = b.id)
            OR
            -- Or we are in the Handshake (Agreed) phase
            b.negotiation_history @> '[{"agreed": true}]'
        )
    )
);

-- 5. Create INSERT Policy
CREATE POLICY "Users can insert their own messages"
ON chat_messages FOR INSERT
WITH CHECK (
    sender_id = auth.uid() 
    AND (
        -- Can only send to people in jobs I am participating in
        EXISTS (
            SELECT 1 FROM jobs j 
            WHERE j.id = chat_messages.job_id 
            AND (
                j.poster_id = auth.uid() -- I am poster
                OR 
                -- I am an accepted worker OR agreed worker
                EXISTS (
                    SELECT 1 FROM bids b 
                    WHERE b.job_id = j.id AND b.worker_id = auth.uid()
                    AND (j.accepted_bid_id = b.id OR b.negotiation_history @> '[{"agreed": true}]')
                )
            )
        )
    )
);

-- 6. Update get_inbox_summaries for robust Handshake support
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
  unread_count BIGINT,
  is_archived BOOLEAN,
  is_deleted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH relevant_jobs AS (
    -- Case A: I am the poster
    SELECT 
      j.id, j.title, j.status, j.poster_id, j.accepted_bid_id,
      COALESCE(b_acc.worker_id, b_agr.worker_id) as counterpart_id
    FROM jobs j
    LEFT JOIN bids b_acc ON b_acc.id = j.accepted_bid_id
    LEFT JOIN LATERAL (
        SELECT worker_id FROM bids 
        WHERE job_id = j.id 
        AND negotiation_history @> '[{"agreed": true}]'
        ORDER BY updated_at DESC LIMIT 1
    ) b_agr ON TRUE
    WHERE j.poster_id = p_user_id
    AND (
        j.status IN ('IN_PROGRESS', 'COMPLETED') 
        OR (j.status = 'OPEN' AND b_agr.worker_id IS NOT NULL)
    )
    
    UNION ALL
    
    -- Case B: I am the worker (Accepted OR Agreed)
    SELECT 
      j.id, j.title, j.status, j.poster_id, j.accepted_bid_id,
      j.poster_id as counterpart_id
    FROM jobs j
    JOIN bids b ON b.job_id = j.id
    WHERE b.worker_id = p_user_id
    AND (
        (j.status IN ('IN_PROGRESS', 'COMPLETED') AND j.accepted_bid_id = b.id)
        OR (j.status = 'OPEN' AND b.negotiation_history @> '[{"agreed": true}]')
    )
  ),
  message_stats AS (
    SELECT DISTINCT ON (m.job_id)
      m.job_id,
      m.text as last_text,
      m.created_at as last_time,
      m.sender_id as last_sender,
      m.read as last_read
    FROM chat_messages m
    WHERE m.job_id IN (SELECT id FROM relevant_jobs)
    ORDER BY m.job_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      n.related_job_id,
      COUNT(*) as count
    FROM notifications n
    WHERE n.user_id = p_user_id
    AND n.read = false
    GROUP BY n.related_job_id
  )
  SELECT 
    rj.id,
    rj.title,
    rj.status,
    rj.poster_id,
    rj.accepted_bid_id,
    rj.counterpart_id,
    p.name as counterpart_name,
    p.profile_photo as counterpart_photo,
    COALESCE(ms.last_text, 'Agreement reached! 👋'),
    COALESCE(ms.last_time, NOW()),
    ms.last_sender,
    ms.last_read,
    COALESCE(un.count, 0),
    COALESCE(cs.is_archived, FALSE),
    COALESCE(cs.is_deleted, FALSE)
  FROM relevant_jobs rj
  JOIN profiles p ON p.id = rj.counterpart_id
  LEFT JOIN message_stats ms ON ms.job_id = rj.id
  LEFT JOIN unread_counts un ON un.related_job_id = rj.id
  LEFT JOIN chat_states cs ON cs.job_id = rj.id AND cs.user_id = p_user_id
  WHERE rj.counterpart_id IS NOT NULL 
    AND COALESCE(cs.is_deleted, FALSE) = FALSE
  ORDER BY COALESCE(ms.last_time, NOW()) DESC;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ Chat sync, Schema, and Handshake RLS fixed successfully';
END $$;
