-- ==========================================
-- FIX: JOBS CATEGORY CONSTRAINT & STORAGE BUCKET
-- Description: Updates allowed categories to match constants.ts
--              Creates the 'job-images' storage bucket.
-- ==========================================

BEGIN;

-- 1. UPDATE JOBS CATEGORY CONSTRAINT
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_category_check;

ALTER TABLE public.jobs ADD CONSTRAINT jobs_category_check CHECK (category IN (
    'Cleaning',
    'Plumbing',
    'Electrical',
    'Carpenter',
    'Painting',
    'AC/Appliance Repair',
    'Gardening',
    'Construction',
    'Labor',
    'Tile & Marble',
    'Welding',
    'Driver',
    'Delivery',
    'Moving/Packers',
    'Farm Labor',
    'Tractor Driver',
    'Other'
));

-- 2. ENSURE STORAGE BUCKET EXISTS (Executed via SQL)
-- Note: inserting into storage.buckets requires appropriate permissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-images', 'job-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies if they don't exist
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'job-images' );

CREATE POLICY "Authenticated Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'job-images' AND auth.role() = 'authenticated' );

CREATE POLICY "Owner Update/Delete" 
ON storage.objects FOR ALL 
USING ( bucket_id = 'job-images' AND auth.uid() = owner );

COMMIT;
