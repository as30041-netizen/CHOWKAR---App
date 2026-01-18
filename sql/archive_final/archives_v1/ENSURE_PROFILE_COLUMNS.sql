
-- Ensure latitude and longitude columns exist in profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Ensure profile_photo column exists (just in case)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- Drop any potentially conflicting or recursive triggers on profiles
-- (We keep the referral one but ensure it's robust)
-- trigger_referral_reward should be fine as analyzed, but let's re-replace it to be sure if needed.
-- actually, let's just make sure we don't have duplicates or old ones.

DO $$
BEGIN
    -- Drop old triggers if they exist by name (cleanup)
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_profile_update') THEN
        DROP TRIGGER on_profile_update ON public.profiles;
    END IF;
END $$;
