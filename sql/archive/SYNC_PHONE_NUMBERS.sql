-- SYNC PHONE NUMBERS ACROSS TABLES
-- This trigger ensures that when a user updates their profile phone, 
-- it's reflected in the jobs and bids tables for active coordination.

CREATE OR REPLACE FUNCTION sync_user_phone_to_jobs_bids()
RETURNS TRIGGER AS $$
BEGIN
    -- Update jobs where this user is the poster
    UPDATE jobs 
    SET poster_phone = NEW.phone 
    WHERE poster_id = NEW.id;

    -- Update bids where this user is the worker
    UPDATE bids 
    SET worker_phone = NEW.phone 
    WHERE worker_id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on profiles
DROP TRIGGER IF EXISTS trg_sync_user_phone ON profiles;
CREATE TRIGGER trg_sync_user_phone
AFTER UPDATE OF phone ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_user_phone_to_jobs_bids();

-- 1-TIME SYNC: Fix all existing de-synced phones
UPDATE jobs j
SET poster_phone = p.phone
FROM profiles p
WHERE j.poster_id = p.id
AND (j.poster_phone IS NULL OR j.poster_phone <> p.phone);

UPDATE bids b
SET worker_phone = p.phone
FROM profiles p
WHERE b.worker_id = p.id
AND (b.worker_phone IS NULL OR b.worker_phone <> p.phone);

DO $$ BEGIN
  RAISE NOTICE '✅ Global phone synchronization complete and trigger active.';
END $$;
