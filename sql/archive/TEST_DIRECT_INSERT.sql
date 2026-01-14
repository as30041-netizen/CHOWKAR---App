-- Test if we can insert a job directly via SQL
-- This bypasses the frontend and tests the database directly

INSERT INTO jobs (
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
    status
) VALUES (
    '69c95415-770e-4da4-8bf8-25084ace911b', -- Jyoti's ID
    'Jyoti Thakur',
    '', -- Empty phone (like frontend)
    'SQL Test Job 2',
    'Testing direct insert after phone fix',
    'Cleaning',
    'Test Location',
    30.65,
    76.85,
    CURRENT_DATE,
    '3',
    500,
    'OPEN'
) RETURNING id, title, created_at;
