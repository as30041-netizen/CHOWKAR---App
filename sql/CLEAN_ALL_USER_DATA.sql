/*
  ============================================================
  CHOWKAR DATABASE CLEANUP SCRIPT
  ============================================================
  
  ⚠️ WARNING: This script will DELETE ALL USER DATA!
  This is a DESTRUCTIVE operation and cannot be undone.
  
  Run this in Supabase SQL Editor with service_role access.
  ============================================================
*/

-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- Delete all data in correct order (respecting foreign keys)
DELETE FROM public.chat_messages;
DELETE FROM public.notifications;
DELETE FROM public.reviews;
DELETE FROM public.transactions;
DELETE FROM public.bids;
DELETE FROM public.jobs;
DELETE FROM public.profiles;
DELETE FROM auth.users;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Verify cleanup
SELECT 
  (SELECT COUNT(*) FROM public.chat_messages) AS chat_messages,
  (SELECT COUNT(*) FROM public.notifications) AS notifications,
  (SELECT COUNT(*) FROM public.reviews) AS reviews,
  (SELECT COUNT(*) FROM public.transactions) AS transactions,
  (SELECT COUNT(*) FROM public.bids) AS bids,
  (SELECT COUNT(*) FROM public.jobs) AS jobs,
  (SELECT COUNT(*) FROM public.profiles) AS profiles,
  (SELECT COUNT(*) FROM auth.users) AS auth_users;
