-- TEST INSERT JOB
-- Run this in SQL Editor to verify DB Logic

BEGIN;

-- Attempt to insert a job for your user ID
INSERT INTO public.jobs (
  poster_id,
  poster_name,
  poster_phone,
  title,
  description,
  category,
  location,
  latitude,
  longitude,
  job_date,
  duration,
  budget,
  status,
  created_at,
  updated_at
) VALUES (
  'e266fa3d-d854-4445-be8b-cd054a2fa859', -- Your User ID from logs
  'Test Poster',
  '1234567890',
  'SQL Test Job',
  'Created via SQL Editor',
  'Farm Labor',
  'Test Location',
  30.6,
  76.8,
  '2026-01-09',
  '4',
  500,
  'OPEN',
  NOW(),
  NOW()
) RETURNING id;

COMMIT;
