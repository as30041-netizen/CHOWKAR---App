-- ============================================================================
-- RPC: CHAT VISIBILITY LOGIC (Soft Delete / Archive)
-- Manages per-user visibility of chat threads using 'chat_states'
-- ============================================================================

-- 1. Ensure Table Exists (Idempotent)
CREATE TABLE IF NOT EXISTS public.chat_states (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, job_id)
);

-- DROP explicit signatures to avoid ambiguity error 42725
DROP FUNCTION IF EXISTS delete_chat(UUID, UUID);
DROP FUNCTION IF EXISTS archive_chat(UUID, UUID, BOOLEAN);

-- 2. RPC: DELETE CHAT (Hide for User)
CREATE OR REPLACE FUNCTION delete_chat(
    p_job_id UUID,
    p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO chat_states (user_id, job_id, is_deleted, updated_at)
    VALUES (p_user_id, p_job_id, TRUE, NOW())
    ON CONFLICT (user_id, job_id) 
    DO UPDATE SET 
        is_deleted = TRUE,
        updated_at = NOW();

    RETURN json_build_object('success', true);
END;
$$;

-- 3. RPC: ARCHIVE CHAT
CREATE OR REPLACE FUNCTION archive_chat(
    p_job_id UUID,
    p_user_id UUID,
    p_archive BOOLEAN DEFAULT TRUE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO chat_states (user_id, job_id, is_archived, updated_at)
    VALUES (p_user_id, p_job_id, p_archive, NOW())
    ON CONFLICT (user_id, job_id) 
    DO UPDATE SET 
        is_archived = p_archive,
        updated_at = NOW();

    RETURN json_build_object('success', true);
END;
$$;

-- Grant Permissions
GRANT EXECUTE ON FUNCTION delete_chat(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_chat(UUID, UUID, BOOLEAN) TO authenticated;
