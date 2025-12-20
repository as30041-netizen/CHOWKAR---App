-- AUTOMATIC RATING UPDATE TRIGGER
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating decimal(3, 2);
BEGIN
  -- Calculate new average
  SELECT AVG(rating) INTO avg_rating
  FROM reviews
  WHERE reviewee_id = NEW.reviewee_id;

  -- Update the profile
  UPDATE profiles 
  SET rating = COALESCE(avg_rating, 5.0) -- Default to 5.0 if null
  WHERE id = NEW.reviewee_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER allows bypassing RLS

DROP TRIGGER IF EXISTS on_review_created ON reviews;
CREATE TRIGGER on_review_created
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION update_user_rating();
