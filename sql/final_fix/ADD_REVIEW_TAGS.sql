-- ==========================================
-- FIX: ADD TAGS TO REVIEWS
-- Description: Adds a 'tags' column (text array) to the reviews table.
--              Updates the view_reviews to include this new column.
-- ==========================================

-- 1. Add Column
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. Update View (if it exists, we need to recreate it to include the new column)
-- Assuming 'view_reviews' exists as seen in reviewService.ts usage.
-- We'll drop and recreate it to be safe, or just rely on the table if the view is simple.
-- Let's check if we can just create/replace.

CREATE OR REPLACE VIEW public.view_reviews AS
SELECT 
    r.id,
    r.job_id,
    r.reviewer_id,
    r.reviewee_id,
    r.rating,
    r.comment,
    r.tags, -- Added
    r.created_at,
    p.full_name as reviewer_name,
    p.photo_url as reviewer_photo,
    false as is_deleted -- Placeholder for soft delete if not implemented in table
FROM public.reviews r
JOIN public.profiles p ON r.reviewer_id = p.id;
