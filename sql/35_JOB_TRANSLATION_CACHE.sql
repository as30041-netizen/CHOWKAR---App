-- ============================================================================
-- SQL: JOB TRANSLATION CACHING (Phase 30)
-- Purpose: Minimizes API costs by caching AI-generated translations
-- ============================================================================

-- 1. Add translations column if it does not exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'translations') THEN
        ALTER TABLE jobs ADD COLUMN translations JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Create RPC to save translations atomically
CREATE OR REPLACE FUNCTION action_save_job_translation(
    p_job_id UUID,
    p_lang TEXT,
    p_translated_title TEXT,
    p_translated_desc TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_translation_entry JSONB;
BEGIN
    -- Prepare the new language entry
    v_translation_entry := jsonb_build_object(
        'title', p_translated_title,
        'description', p_translated_desc,
        'cached_at', (extract(epoch from now()) * 1000)
    );

    -- Update the jobs table by merging the new translation into the JSONB object
    UPDATE jobs
    SET translations = COALESCE(translations, '{}'::jsonb) || jsonb_build_object(p_lang, v_translation_entry)
    WHERE id = p_job_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

DO $$ 
BEGIN 
    RAISE NOTICE '✅ Job Translation Caching deployed successfully.'; 
END $$;
