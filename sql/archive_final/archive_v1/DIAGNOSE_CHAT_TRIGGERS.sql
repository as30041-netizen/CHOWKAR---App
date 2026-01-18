-- ============================================
-- DIAGNOSE CHAT TRIGGERS
-- ============================================
-- Checks for duplicate or conflicting triggers on the chat_messages table.

DO $$
DECLARE
  trigger_count INTEGER;
  trigger_name TEXT;
  function_name TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '🔍 CHECKING FOR CHAT TRIGGERS';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  
  -- Check how many triggers exist on chat_messages table for INSERT
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'chat_messages'::regclass
    AND tgtype & 4 = 4; -- INSERT triggers
  
  RAISE NOTICE 'Total INSERT triggers on chat_messages: %', trigger_count;
  
  -- List all triggers
  FOR trigger_name, function_name IN 
    SELECT t.tgname, p.proname
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE tgrelid = 'chat_messages'::regclass
      AND tgtype & 4 = 4
  LOOP
    RAISE NOTICE '  - Trigger: %  -> Function: %', trigger_name, function_name;
  END LOOP;
  
  IF trigger_count > 1 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  WARNING: Multiple triggers found! Potential for duplicate notifications.';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✅ OK: Single trigger found (check if it is the correct one).';
  END IF;
  
  RAISE NOTICE '================================================';
END $$;
