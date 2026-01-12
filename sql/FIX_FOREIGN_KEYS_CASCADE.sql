-- FIX FOREIGN KEYS for Job Deletion
-- Updated for Standard Schema (2025) - Removing legacy tables

BEGIN;

-- 1. BIDS
ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_job_id_fkey;
ALTER TABLE public.bids 
  ADD CONSTRAINT bids_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

-- 2. CHAT MESSAGES
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_job_id_fkey;
ALTER TABLE public.chat_messages 
  ADD CONSTRAINT chat_messages_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

-- 3. NOTIFICATIONS
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_related_job_id_fkey;
ALTER TABLE public.notifications 
  ADD CONSTRAINT notifications_related_job_id_fkey 
  FOREIGN KEY (related_job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;

-- 4. REVIEWS
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_job_id_fkey;
ALTER TABLE public.reviews 
  ADD CONSTRAINT reviews_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;

COMMIT;
