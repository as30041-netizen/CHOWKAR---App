-- ==========================================
-- FIX NOTIFICATIONS TYPE CONSTRAINT
-- Description: Updates the notifications table to allow 'SYSTEM' type
-- ==========================================

-- Step 1: Drop the old constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Step 2: Update any non-standard types to 'SYSTEM' (preserves existing data)
UPDATE public.notifications
SET type = 'SYSTEM'
WHERE type NOT IN ('JOB_UPDATE', 'BID_RECEIVED', 'BID_ACCEPTED', 'MESSAGE', 'PAYMENT', 'SYSTEM', 'ACHIEVEMENT');

-- Step 3: Add the new constraint with 'SYSTEM' included
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('JOB_UPDATE', 'BID_RECEIVED', 'BID_ACCEPTED', 'MESSAGE', 'PAYMENT', 'SYSTEM', 'ACHIEVEMENT'));

