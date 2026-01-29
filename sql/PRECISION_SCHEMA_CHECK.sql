/*
  ============================================================
  PRECISION SCHEMA CHECK
  ============================================================
  This script checks the EXACT types of the profiles table
  to ensure the JS code sends the correct data formats.
  ============================================================
*/

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    character_maximum_length,
    udt_name -- This gives the specific postgres type (e.g. int8 for bigint)
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;
