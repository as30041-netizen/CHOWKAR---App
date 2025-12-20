-- ============================================
-- PHASE 6: REVIEWS & RATINGS
-- ============================================

-- 1. Ensure review_count column exists on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- 2. Function to update user rating AND review count
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DECIMAL(3, 2);
  total_reviews INTEGER;
BEGIN
  -- Calculate new average rating
  SELECT AVG(rating), COUNT(*) INTO avg_rating, total_reviews
  FROM reviews
  WHERE reviewee_id = NEW.reviewee_id;

  -- Update the profile
  UPDATE profiles 
  SET 
    rating = COALESCE(avg_rating, 5.0),
    review_count = total_reviews
  WHERE id = NEW.reviewee_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger to auto-update ratings after review submission
DROP TRIGGER IF EXISTS on_review_created ON reviews;
CREATE TRIGGER on_review_created
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION update_user_rating();

-- 4. Prevent duplicate reviews (one review per job per reviewer)
-- First check if constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_review_per_job'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT unique_review_per_job UNIQUE (reviewer_id, job_id);
  END IF;
END $$;

-- 5. Grant necessary permissions
GRANT ALL ON reviews TO authenticated;
