-- FIX_USER_REPORTS.sql
-- Purpose: Resolve 400 error due to column mismatch (description vs details).
-- UPDATE: Secure Policies for Admins only.

BEGIN;

-- 1. DROP EXISTING TABLE (To ensure clean schema change)
DROP TABLE IF EXISTS public.user_reports;

-- 2. CREATE TABLE WITH CORRECT COLUMNS
CREATE TABLE public.user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    reported_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE RLS
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES

-- Reporters can create reports
DROP POLICY IF EXISTS "Users can insert reports" ON public.user_reports;
CREATE POLICY "Users can insert reports" ON public.user_reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Reporters can view their OWN reports (to see status updates)
DROP POLICY IF EXISTS "Users can view own reports" ON public.user_reports;
CREATE POLICY "Users can view own reports" ON public.user_reports
    FOR SELECT USING (auth.uid() = reporter_id);

-- SECURE: Admins can view ALL reports
DROP POLICY IF EXISTS "Admins can view all reports" ON public.user_reports;
CREATE POLICY "Admins can view all reports" ON public.user_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- SECURE: Admins can update ALL reports
DROP POLICY IF EXISTS "Admins can update all reports" ON public.user_reports;
CREATE POLICY "Admins can update all reports" ON public.user_reports
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

COMMIT;
