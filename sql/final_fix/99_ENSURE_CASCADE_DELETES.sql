-- ============================================================================
-- ENSURE CASCADE DELETES FOR ACCOUNT DELETION (FIXED - CLEANUP VERSION)
-- Ensures that deleting a user from auth.users cleaner up EVERYTHING.
-- ============================================================================

-- 1. Profiles -> Auth Users
DO $$ 
BEGIN
    -- Cleanup: Remove profiles that point to non-existent auth users
    DELETE FROM profiles WHERE id NOT IN (SELECT id FROM auth.users);

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
    ) THEN
        ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;
    END IF;
    
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- 2. Jobs -> Profiles
DO $$ 
BEGIN
    -- Cleanup: Remove jobs pointing to non-existent profiles
    DELETE FROM jobs WHERE poster_id NOT IN (SELECT id FROM profiles);

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'jobs_poster_id_fkey' AND table_name = 'jobs') THEN
        ALTER TABLE jobs DROP CONSTRAINT jobs_poster_id_fkey;
    END IF;
    
    ALTER TABLE jobs 
    ADD CONSTRAINT jobs_poster_id_fkey 
    FOREIGN KEY (poster_id) REFERENCES profiles(id) ON DELETE CASCADE;
END $$;

-- 3. Bids -> Profiles & Jobs
DO $$ 
BEGIN
    -- Cleanup: Remove orphaned bids
    DELETE FROM bids WHERE worker_id NOT IN (SELECT id FROM profiles);
    DELETE FROM bids WHERE job_id NOT IN (SELECT id FROM jobs);

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'bids_worker_id_fkey' AND table_name = 'bids') THEN
        ALTER TABLE bids DROP CONSTRAINT bids_worker_id_fkey;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'bids_job_id_fkey' AND table_name = 'bids') THEN
        ALTER TABLE bids DROP CONSTRAINT bids_job_id_fkey;
    END IF;
    
    ALTER TABLE bids 
    ADD CONSTRAINT bids_worker_id_fkey 
    FOREIGN KEY (worker_id) REFERENCES profiles(id) ON DELETE CASCADE;

    ALTER TABLE bids 
    ADD CONSTRAINT bids_job_id_fkey 
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
END $$;

-- 4. Notifications -> Profiles
DO $$ 
BEGIN
    -- Cleanup orphans
    DELETE FROM notifications WHERE user_id NOT IN (SELECT id FROM profiles);

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'notifications_user_id_fkey' AND table_name = 'notifications') THEN
        ALTER TABLE notifications DROP CONSTRAINT notifications_user_id_fkey;
    END IF;
    
    ALTER TABLE notifications 
    ADD CONSTRAINT notifications_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
END $$;

-- 6. Reviews -> Profiles
DO $$ 
BEGIN
    -- Cleanup orphans
    DELETE FROM reviews WHERE reviewer_id NOT IN (SELECT id FROM profiles);
    DELETE FROM reviews WHERE reviewee_id NOT IN (SELECT id FROM profiles);

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_reviewer_id_fkey' AND table_name = 'reviews') THEN
        ALTER TABLE reviews DROP CONSTRAINT reviews_reviewer_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_reviewee_id_fkey' AND table_name = 'reviews') THEN
        ALTER TABLE reviews DROP CONSTRAINT reviews_reviewee_id_fkey;
    END IF;
    
    ALTER TABLE reviews 
    ADD CONSTRAINT reviews_reviewer_id_fkey 
    FOREIGN KEY (reviewer_id) REFERENCES profiles(id) ON DELETE CASCADE;
    
    ALTER TABLE reviews 
    ADD CONSTRAINT reviews_reviewee_id_fkey 
    FOREIGN KEY (reviewee_id) REFERENCES profiles(id) ON DELETE CASCADE;
END $$;

-- 7. Chat Messages -> Profiles
DO $$ 
BEGIN
    -- Cleanup orphaned chat messages
    DELETE FROM chat_messages WHERE sender_id NOT IN (SELECT id FROM profiles);
    DELETE FROM chat_messages WHERE receiver_id NOT IN (SELECT id FROM profiles);

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chat_messages_sender_id_fkey' AND table_name = 'chat_messages') THEN
        ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_sender_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chat_messages_receiver_id_fkey' AND table_name = 'chat_messages') THEN
        ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_receiver_id_fkey;
    END IF;
    
    ALTER TABLE chat_messages 
    ADD CONSTRAINT chat_messages_sender_id_fkey 
    FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

    ALTER TABLE chat_messages 
    ADD CONSTRAINT chat_messages_receiver_id_fkey 
    FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE;
END $$;

-- 8. User Blocks -> Profiles
DO $$ 
BEGIN
    -- Cleanup orphaned blocks
    DELETE FROM user_blocks WHERE blocker_id NOT IN (SELECT id FROM profiles);
    DELETE FROM user_blocks WHERE blocked_id NOT IN (SELECT id FROM profiles);

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_blocks_blocker_id_fkey' AND table_name = 'user_blocks') THEN
        ALTER TABLE user_blocks DROP CONSTRAINT user_blocks_blocker_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_blocks_blocked_id_fkey' AND table_name = 'user_blocks') THEN
        ALTER TABLE user_blocks DROP CONSTRAINT user_blocks_blocked_id_fkey;
    END IF;
    
    ALTER TABLE user_blocks 
    ADD CONSTRAINT user_blocks_blocker_id_fkey 
    FOREIGN KEY (blocker_id) REFERENCES profiles(id) ON DELETE CASCADE;

    ALTER TABLE user_blocks 
    ADD CONSTRAINT user_blocks_blocked_id_fkey 
    FOREIGN KEY (blocked_id) REFERENCES profiles(id) ON DELETE CASCADE;
END $$;
