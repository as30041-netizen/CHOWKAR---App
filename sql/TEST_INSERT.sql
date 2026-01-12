-- TEST DIRECT INSERT VIA SQL (CORRECTED CATEGORY)
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get any valid user ID
  SELECT id INTO v_user_id FROM profiles LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO jobs (
      id, 
      poster_id, 
      poster_name, 
      title, 
      description, 
      budget, 
      status, 
      created_at, 
      category, 
      location, 
      job_date, 
      duration
    )
    VALUES (
      gen_random_uuid(),
      v_user_id,
      'SQL Test User',
      'SQL Test Job - Valid Category',
      'Testing direct insert with valid Plumbing category',
      777,
      'OPEN',
      now(),
      'Plumbing', -- CORRECTED CATEGORY MATCHING DB CONSTRAINT
      'Mumbai',
      CURRENT_DATE,
      '2 hours'
    );
    RAISE NOTICE '✅ Job inserted successfully for user %', v_user_id;
  ELSE
    RAISE NOTICE '❌ No users found in profiles table';
  END IF;
END $$;
