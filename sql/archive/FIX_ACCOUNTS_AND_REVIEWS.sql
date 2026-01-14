-- ============================================
-- FIX ACCOUNTS AND REVIEWS
-- ============================================
-- 1. Add Soft Delete to Reviews (Data Preservation)
-- 2. Create Secure View for Reviews (Privacy)
-- 3. Install Rating Aggregation Trigger (Auto-Update Stars)
-- 4. Harden RLS

-- ============================================
-- STEP 1: Add is_deleted to Reviews
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'is_deleted') THEN
        ALTER TABLE reviews ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- ============================================
-- STEP 2: Create Secure View for Reviews
-- ============================================

DROP VIEW IF EXISTS view_reviews;

CREATE VIEW view_reviews AS
SELECT
  r.id,
  r.reviewer_id,
  r.reviewee_id,
  r.job_id,
  r.rating,
  -- MASKING LOGIC: If deleted, hide the comment
  CASE 
    WHEN r.is_deleted THEN '🚫 This review was deleted'
    ELSE r.comment 
  END AS comment,
  r.tags,
  r.created_at,
  r.is_deleted,
  -- Join reviewer details for convenience
  p.name as reviewer_name,
  p.profile_photo as reviewer_photo
FROM reviews r
LEFT JOIN profiles p ON p.id = r.reviewer_id;

GRANT SELECT ON view_reviews TO authenticated;

-- ============================================
-- STEP 3: Rating Aggregation Logic
-- ============================================

CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg_rating DECIMAL(3, 2);
  v_count INTEGER;
  v_target_user_id UUID;
BEGIN
  -- Determine who was reviewed
  IF (TG_OP = 'DELETE') THEN
    v_target_user_id := OLD.reviewee_id;
  ELSE
    v_target_user_id := NEW.reviewee_id;
  END IF;

  -- Calculate new stats (ignoring deleted reviews)
  SELECT 
    COALESCE(AVG(rating), 5.0),
    COUNT(*)
  INTO v_avg_rating, v_count
  FROM reviews
  WHERE reviewee_id = v_target_user_id
    AND is_deleted = FALSE; -- Important: Don't count deleted reviews in average

  -- Update Profile
  UPDATE profiles
  SET 
    rating = v_avg_rating,
    jobs_completed = (SELECT COUNT(*) FROM jobs WHERE accepted_bid_id IN (SELECT id FROM bids WHERE worker_id = v_target_user_id) AND status = 'COMPLETED') -- Optional: sync jobs completed too
  WHERE id = v_target_user_id;

  RETURN NULL;
END;
$$;

-- Drop trigger if exists to recreate clean
DROP TRIGGER IF EXISTS trigger_update_user_rating ON reviews;

CREATE TRIGGER trigger_update_user_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_user_rating();

-- ============================================
-- STEP 4: Soft Delete Function
-- ============================================

CREATE OR REPLACE FUNCTION soft_delete_review(p_review_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE reviews
    SET is_deleted = TRUE
    WHERE id = p_review_id 
      AND reviewer_id = auth.uid(); -- Only author can delete
      
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found or permission denied';
    END IF;
END;
$$;

-- ============================================
-- STEP 5: Verify RLS
-- ============================================
-- Ensure policies allow reading reviews but only writing own

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
CREATE POLICY "Anyone can view reviews" ON reviews FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
CREATE POLICY "Users can create reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE TO authenticated USING (reviewer_id = auth.uid());

DO $$ BEGIN RAISE NOTICE '✅ Reviews feature updated with Soft Delete, Secure View, and Auto-Ratings.'; END $$;
