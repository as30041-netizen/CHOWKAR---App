-- FIX REALTIME VISIBILITY & RLS (Corrected)

-- 1. Set Replica Identity to FULL
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

-- 2. RESET RLS Policies for Chat Messages (Drop ALL potential existing names)
DROP POLICY IF EXISTS "Users can view chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can view messages" ON chat_messages;
DROP POLICY IF EXISTS "Everyone can view messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages" ON chat_messages;

-- 3. Create a ROBUST Select Policy
-- This allows access if you are the Job Poster OR the Accepted Worker
CREATE POLICY "Users can view chat messages" ON chat_messages
FOR SELECT USING (
  auth.uid() = sender_id -- You can always see your own messages
  OR
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = chat_messages.job_id 
    AND (
        jobs.poster_id = auth.uid() 
        OR 
        EXISTS (SELECT 1 FROM bids WHERE bids.job_id = jobs.id AND bids.worker_id = auth.uid() AND bids.status = 'ACCEPTED')
    )
  )
);

-- 4. Create Insert Policy
CREATE POLICY "Users can insert chat messages" ON chat_messages
FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 5. Grant permissions to authenticated users
GRANT SELECT, INSERT ON chat_messages TO authenticated;
