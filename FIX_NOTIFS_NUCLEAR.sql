-- NUCLEAR FIX FOR NOTIFICATIONS
-- Run this in Supabase SQL Editor

-- Disable RLS on notifications table to guarantee inserts work
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Verify poster_id column exists (just in case)
ALTER TABLE bids ADD COLUMN IF NOT EXISTS poster_id uuid REFERENCES auth.users(id);
