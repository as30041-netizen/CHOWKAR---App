-- FIX INFINITE RECURSION IN RLS POLICIES
-- Run this in your Supabase SQL Editor

BEGIN;

-- 1. Drop the problematic policies that cause infinite loops
DROP POLICY IF EXISTS "Anyone can view open jobs" ON jobs;
DROP POLICY IF EXISTS "Workers can view own bids" ON bids;
DROP POLICY IF EXISTS "Poster can update bids on their jobs" ON bids;
DROP POLICY IF EXISTS "Job participants can view chat" ON chat_messages;
DROP POLICY IF EXISTS "Job participants can send messages" ON chat_messages;

-- 2. Create new, optimized policies for JOBS
-- Allows viewing open jobs OR jobs you posted (no subquery recursion)
CREATE POLICY "Users can view open jobs and own jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    status = 'OPEN' OR 
    poster_id = auth.uid()
  );

-- Allows workers to view jobs they have bid on (using EXISTS to verify)
CREATE POLICY "Workers can view jobs they bid on"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.job_id = jobs.id
      AND bids.worker_id = auth.uid()
    )
  );

-- 3. Create new policies for BIDS
-- Allows workers to view their own bids
CREATE POLICY "Workers can view own bids"
  ON bids FOR SELECT
  TO authenticated
  USING (
    worker_id = auth.uid()
  );

-- Allows posters to view bids on their jobs (using EXISTS to verify)
CREATE POLICY "Posters can view bids on own jobs"
  ON bids FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = bids.job_id
      AND jobs.poster_id = auth.uid()
    )
  );

-- Allows posters to update (accept/reject) bids on their jobs
CREATE POLICY "Posters can update bids on own jobs"
  ON bids FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = bids.job_id
      AND jobs.poster_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = bids.job_id
      AND jobs.poster_id = auth.uid()
    )
  );

-- 4. Create new policies for CHAT MESSAGES
CREATE POLICY "Job participants can view chat"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = chat_messages.job_id
      AND jobs.poster_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM jobs
      JOIN bids ON bids.id = jobs.accepted_bid_id
      WHERE jobs.id = chat_messages.job_id
      AND bids.worker_id = auth.uid()
    )
  );

CREATE POLICY "Job participants can send messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    (
      EXISTS (
        SELECT 1 FROM jobs
        WHERE jobs.id = chat_messages.job_id
        AND jobs.poster_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM jobs
        JOIN bids ON bids.id = jobs.accepted_bid_id
        WHERE jobs.id = chat_messages.job_id
        AND bids.worker_id = auth.uid()
      )
    )
  );

COMMIT;
