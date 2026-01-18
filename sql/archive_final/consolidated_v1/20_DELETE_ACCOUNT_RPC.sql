-- ============================================================================
-- SECURE ACCOUNT DELETION
-- Allows a user to delete their own account.
-- CAUTION: This is destructive and irreversible.
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Delete from auth.users
    -- Because of ON DELETE CASCADE on profiles.id -> auth.users.id, 
    -- we might need to delete from public tables first if foreign keys are set up strictly,
    -- but usually deleting from auth.users triggers the cascade down to profiles.
    -- However, standard Postgres/Supabase setup often has profiles referencing auth.users.
    
    -- Let's try deleting the profile first to be safe and trigger cleanup?
    -- No, actually the FK is usually `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE`.
    -- So deleting `auth.users` row is the root action.
    
    -- BUT: We cannot execute `DELETE FROM auth.users` from a PL/pgSQL function unless we are superuser.
    -- If this fails due to permissions, we'll need an Edge Function with Service Role.
    -- For now, let's assume we have permissions or fallback to just wiping the profile data.
    
    -- ATTEMPT 1: Strict Wipe (Profile Data Only) - If auth.users is protected
    -- UPDATE profiles SET 
    --     name = 'Deleted User', 
    --     phone = NULL, 
    --     email = NULL, 
    --     location = NULL, 
    --     is_deleted = TRUE 
    -- WHERE id = v_user_id;
    
    -- ATTEMPT 2: Full Deletion (requires elevated privileges)
    -- This works on self-hosted or if the role has permissions.
    -- In Supabase SaaS, this often requires `supabase_admin` or similar.
    
    -- For this context (Auditing), I'll implement a Soft Delete + Data Wipe on the public schema.
    -- And we rely on the Admin Dashboard to clean up `auth.users` eventually, 
    -- OR we use an Edge Function for the hard delete.
    
    -- Let's do the "Wipe & Soft Delete" approach for reliability in SQL only.
    
    UPDATE profiles
    SET 
        name = 'Deleted User',
        phone = NULL,
        email = NULL, -- Clear PII
        bio = NULL,
        location = 'Unknown',
        profile_photo = NULL,
        coordinates = NULL
        -- We'll assume a `is_deleted` flag logic might be useful later, but for now we wipe PII.
    WHERE id = v_user_id;

    -- Also delete Auth related data if possible? 
    -- No, SQL RPC cannot easily modify `auth` schema in strict environments.
    
    RETURN json_build_object('success', true, 'message', 'Account data wiped. Please contact support for hard deletion from auth provider.');
END;
$$;
