-- ============================================================
-- FIX CHAT ACCESS & 406 ERRORS
-- Date: 2024-12-18
-- ============================================================

-- 1. DROP PROBLEMATIC POLICIES
DROP POLICY IF EXISTS "Users can read messages for their jobs" ON chat_messages;
DROP POLICY IF EXISTS "authenticated_can_read_chat" ON chat_messages;
DROP POLICY IF EXISTS "Users can read own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can read chat_messages" ON chat_messages;

-- 2. CREATE ROBUST SELECT POLICY
-- This allows any participant (sender or receiver) to see the message.
-- Also allows the job poster to see all messages for their job.
CREATE POLICY "participant_select_policy" ON chat_messages
FOR SELECT TO authenticated
USING (
  auth.uid() = sender_id 
  OR auth.uid() = receiver_id
  OR EXISTS (
    SELECT 1 FROM jobs 
    WHERE id = job_id 
    AND poster_id = auth.uid()
  )
);

-- 3. ENSURE INSERT POLICY EXISTS
DROP POLICY IF EXISTS "Users can insert chat_messages" ON chat_messages;
CREATE POLICY "Users can insert chat_messages" ON chat_messages
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- 4. FIX JOBS RLS (Ensure participants can always see their jobs)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Viewable by participants" ON jobs;
CREATE POLICY "Viewable by participants" ON jobs
FOR SELECT TO authenticated
USING (
  poster_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM bids 
    WHERE job_id = jobs.id AND worker_id = auth.uid()
  )
  OR status = 'OPEN'
);

-- 5. FIX BIDS RLS (Ensure workers can see their own bids)
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view relevant bids" ON bids;
CREATE POLICY "Users can view relevant bids" ON bids
FOR SELECT TO authenticated
USING (
  worker_id = auth.uid() 
  OR poster_id = auth.uid()
);

-- 6. GRANT PERMISSIONS
GRANT SELECT, INSERT, UPDATE ON chat_messages TO authenticated;
GRANT SELECT ON jobs TO authenticated;
GRANT SELECT ON bids TO authenticated;
