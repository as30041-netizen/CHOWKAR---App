-- Fix: Make poster_phone nullable
-- The column should be optional, not required

ALTER TABLE jobs 
ALTER COLUMN poster_phone DROP NOT NULL;
