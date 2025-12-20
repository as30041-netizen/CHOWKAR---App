-- Clean Script for Chowkar Tables
-- Run this in Supabase SQL Editor

-- 1. Create CHATS table if missing
CREATE TABLE IF NOT EXISTS chats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    job_id UUID REFERENCES jobs(id) NOT NULL,
    user1_id UUID REFERENCES auth.users(id) NOT NULL,
    user2_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_text TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message_sender_id UUID,
    user1_archived BOOLEAN DEFAULT FALSE,
    user2_archived BOOLEAN DEFAULT FALSE,
    user1_deleted_until TIMESTAMP WITH TIME ZONE,
    user2_deleted_until TIMESTAMP WITH TIME ZONE,
    UNIQUE(job_id, user1_id, user2_id)
);

-- 2. Enable RLS on Chats
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- 3. Policy for Chats (Safe handling)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'Users can view their own chats') THEN
        CREATE POLICY "Users can view their own chats" ON chats
            FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
    END IF;
END $$;

-- 4. Create USER_REPORTS table
CREATE TABLE IF NOT EXISTS user_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reporter_id UUID REFERENCES auth.users(id) NOT NULL,
    reported_id UUID REFERENCES auth.users(id) NOT NULL,
    job_id UUID REFERENCES jobs(id),
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED')),
    admin_notes TEXT
);

-- 5. Enable RLS on Reports
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- 6. Add 'role' to profiles for Admin check (Status: WORKER, POSTER, ADMIN)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'WORKER';

-- 7. Policies for Reports
DO $$ 
BEGIN
    -- Admin View Policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_reports' AND policyname = 'Admins can view all reports') THEN
        CREATE POLICY "Admins can view all reports" ON user_reports 
            FOR SELECT USING (
                (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN' 
                OR auth.uid() = reporter_id
            );
    END IF;

    -- Insert Policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_reports' AND policyname = 'Users can insert reports') THEN
        CREATE POLICY "Users can insert reports" ON user_reports 
            FOR INSERT WITH CHECK (auth.uid() = reporter_id);
    END IF;
END $$;

-- 8. Helper Functions for Notifications (CRITICAL FOR UI)
-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS VOID AS $$
BEGIN
  UPDATE notifications SET read = TRUE WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear all notifications
CREATE OR REPLACE FUNCTION clear_all_notifications()
RETURNS VOID AS $$
BEGIN
  DELETE FROM notifications WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a single notification
CREATE OR REPLACE FUNCTION soft_delete_notification(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM notifications WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
