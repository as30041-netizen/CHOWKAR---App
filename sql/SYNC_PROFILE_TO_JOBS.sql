-- ============================================================================
-- SQL: PROFILE-TO-JOB SYNC TRIGGER
-- Purpose: Automatically updates jobs table when a user's profile changes
-- ============================================================================

-- 1. Create the sync function
CREATE OR REPLACE FUNCTION handle_profile_update_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if critical fields have changed to avoid unnecessary updates
    IF (OLD.name IS DISTINCT FROM NEW.name) OR 
       (OLD.phone IS DISTINCT FROM NEW.phone) OR 
       (OLD.profile_photo IS DISTINCT FROM NEW.profile_photo) THEN
       
        UPDATE jobs
        SET 
            poster_name = NEW.name,
            poster_phone = NEW.phone,
            poster_photo = NEW.profile_photo
        WHERE poster_id = NEW.id;
        
        RAISE NOTICE 'Profile Sync: Updated jobs for user % (%)', NEW.id, NEW.name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_profile_update_sync ON profiles;

-- 3. Create the trigger
CREATE TRIGGER trigger_profile_update_sync
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION handle_profile_update_sync();

DO $$ 
BEGIN 
    RAISE NOTICE '✅ Profile-to-Job Sync Trigger deployed successfully.'; 
END $$;
