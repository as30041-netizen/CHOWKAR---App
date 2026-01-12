-- ============================================
-- TEST get_inbox_summaries RPC DIRECTLY
-- ============================================
-- Test the RPC with actual user IDs from your data
-- ============================================

-- 1. Test with poster user: e266fa3d-d854-4445-be8b-cd054a2fa859
SELECT * FROM get_inbox_summaries('e266fa3d-d854-4445-be8b-cd054a2fa859');

-- 2. Test with worker user: 69c95415-770e-4da4-8bf8-25084ace911b
SELECT * FROM get_inbox_summaries('69c95415-770e-4da4-8bf8-25084ace911b');

-- 3. Check chat_states table for blocking conditions
SELECT 
    job_id,
    user_id,
    is_archived,
    is_deleted,
    'chat_states blocking' as source
FROM chat_states
WHERE job_id IN (
    'c91f4a37-5528-494d-b385-042dcbd5b5a8',
    '3ba2ec66-29fa-489b-84ef-4cba450c280e',
    '81869957-fb6c-4f3f-a1f2-6bb46391ce95',
    'aa156bf7-85e9-41bd-b828-3cb89c535934',
    '973c9b8e-aff2-484e-a014-fe1a8a8c6fb3'
)
AND is_deleted = true;

-- 4. Check user_job_visibility table for blocking conditions
SELECT 
    job_id,
    user_id,
    is_hidden,
    'visibility blocking' as source
FROM user_job_visibility
WHERE job_id IN (
    'c91f4a37-5528-494d-b385-042dcbd5b5a8',
    '3ba2ec66-29fa-489b-84ef-4cba450c280e',
    '81869957-fb6c-4f3f-a1f2-6bb46391ce95',
    'aa156bf7-85e9-41bd-b828-3cb89c535934',
    '973c9b8e-aff2-484e-a014-fe1a8a8c6fb3'
)
AND is_hidden = true;

-- 5. Check if tables exist
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'chat_states'
) as chat_states_exists;

SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_job_visibility'
) as user_job_visibility_exists;
