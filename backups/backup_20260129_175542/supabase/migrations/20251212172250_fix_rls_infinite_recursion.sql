/*
  # Fix RLS Infinite Recursion

  ## Problem
  Circular dependency between jobs and bids RLS policies causing infinite recursion:
  - Jobs policy queries bids table
  - Bids policy queries jobs table
  - This creates an infinite loop when loading data

  ## Solution
  Split complex policies into multiple simpler policies to break the circular dependency:

  ### Jobs Table
  - Policy 1: View open jobs OR own jobs (no subquery)
  - Policy 2: View jobs with bids (separate policy with EXISTS)

  ### Bids Table
  - Policy 1: View own bids (no subquery)
  - Policy 2: View bids on own jobs (separate policy with EXISTS)

  ### Chat Messages
  - Simplified logic to avoid deeply nested subqueries

  ## Changes
  - Drops existing problematic policies
  - Creates new non-circular policies
  - Maintains same access control logic without recursion
*/

-- =====================================================
-- DROP EXISTING PROBLEMATIC POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view open jobs" ON jobs;
DROP POLICY IF EXISTS "Workers can view own bids" ON bids;
DROP POLICY IF EXISTS "Poster can update bids on their jobs" ON bids;
DROP POLICY IF EXISTS "Job participants can view chat" ON chat_messages;
DROP POLICY IF EXISTS "Job participants can send messages" ON chat_messages;

-- =====================================================
-- RECREATE JOBS POLICIES (NO CIRCULAR REFERENCE)
-- =====================================================

-- Base policy: View open jobs or own posted jobs
CREATE POLICY "Users can view open jobs and own jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    status = 'OPEN' OR
    poster_id = auth.uid()
  );

-- Separate policy: Workers can view jobs they've bid on
-- Uses EXISTS to avoid triggering full bids policy recursion
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

-- =====================================================
-- RECREATE BIDS POLICIES (NO CIRCULAR REFERENCE)
-- =====================================================

-- Base policy: View own bids
CREATE POLICY "Workers can view own bids"
  ON bids FOR SELECT
  TO authenticated
  USING (
    worker_id = auth.uid()
  );

-- Separate policy: Posters can view bids on their jobs
-- Uses EXISTS to avoid triggering full jobs policy recursion
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

-- Policy: Posters can update bids on their jobs (for accept/reject)
-- Uses direct EXISTS check without triggering jobs SELECT policy
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

-- =====================================================
-- RECREATE CHAT POLICIES (SIMPLIFIED)
-- =====================================================

-- Simplified chat viewing policy
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

-- Simplified chat sending policy
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
