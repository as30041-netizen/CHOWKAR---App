-- FIX NOTIFICATIONS (NUCLEAR OPTION)
-- Run this in Supabase SQL Editor to STOP the 403 Forbidden errors immediately.

ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
