-- Fix Job Deletion by ensuring Cascade Delete on related tables
-- This ensures that when a job is deleted, all associated bids, messages, and notifications are also removed.

-- 1. Bids
ALTER TABLE public.bids
DROP CONSTRAINT IF EXISTS bids_job_id_fkey;

ALTER TABLE public.bids
ADD CONSTRAINT bids_job_id_fkey
FOREIGN KEY (job_id) REFERENCES public.jobs(id)
ON DELETE CASCADE;

-- 2. Chat Messages
ALTER TABLE public.chat_messages
DROP CONSTRAINT IF EXISTS chat_messages_job_id_fkey;

ALTER TABLE public.chat_messages
ADD CONSTRAINT chat_messages_job_id_fkey
FOREIGN KEY (job_id) REFERENCES public.jobs(id)
ON DELETE CASCADE;

-- 3. Notifications (related_job_id)
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_related_job_id_fkey;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_related_job_id_fkey
FOREIGN KEY (related_job_id) REFERENCES public.jobs(id)
ON DELETE CASCADE;

-- 4. Reviews
ALTER TABLE public.reviews
DROP CONSTRAINT IF EXISTS reviews_job_id_fkey;

ALTER TABLE public.reviews
ADD CONSTRAINT reviews_job_id_fkey
FOREIGN KEY (job_id) REFERENCES public.jobs(id)
ON DELETE CASCADE;
