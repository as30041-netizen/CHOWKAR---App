-- CHECK CONSTRAINT DEFINITION
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'jobs_category_check';
