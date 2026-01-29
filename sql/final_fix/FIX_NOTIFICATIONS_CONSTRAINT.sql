-- ==========================================
-- FIX NOTIFICATIONS TYPE CONSTRAINT
-- Description: Updates the notifications table to allow 'INFO', 'SUCCESS', and 'ALERT' types
-- ==========================================

-- Step 1: Drop the old constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Step 2: Add the expanded constraint
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    'JOB_UPDATE', 
    'BID_RECEIVED', 
    'BID_ACCEPTED', 
    'MESSAGE', 
    'PAYMENT', 
    'SYSTEM', 
    'ACHIEVEMENT', 
    'INFO', 
    'SUCCESS', 
    'ALERT',
    'WARNING',
    'NOTICE',
    'ERROR'
));

-- Step 3: Verify existing data (optional cleanup)
-- Update any non-standard types to 'SYSTEM' just in case
UPDATE public.notifications
SET type = 'SYSTEM'
WHERE type NOT IN (
    'JOB_UPDATE', 'BID_RECEIVED', 'BID_ACCEPTED', 'MESSAGE', 
    'PAYMENT', 'SYSTEM', 'ACHIEVEMENT', 'INFO', 'SUCCESS', 'ALERT', 'WARNING', 'NOTICE', 'ERROR'
);
