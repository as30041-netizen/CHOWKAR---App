-- ============================================================================
-- SECURE REVIEWS SYSTEM
-- 1. RLS Policies
-- 2. Notification Trigger
-- 3. Auto-Rating Calculation
-- ============================================================================

BEGIN;

-- 1. ENABLE RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON reviews;

-- A. View Policy (Public)
CREATE POLICY "Reviews are viewable by everyone" ON reviews
FOR SELECT USING (true);

-- B. Insert Policy (Authenticated)
CREATE POLICY "Users can create reviews" ON reviews
FOR INSERT
WITH CHECK (auth.uid() = reviewer_id);

-- 2. NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION notify_reviewee()
RETURNS TRIGGER AS $$
DECLARE
    v_reviewer_name TEXT;
BEGIN
    SELECT name INTO v_reviewer_name FROM profiles WHERE id = NEW.reviewer_id;
    
    INSERT INTO notifications (user_id, title, message, type, related_job_id)
    VALUES (
        NEW.reviewee_id,
        'New Review Received! 🌟',
        COALESCE(v_reviewer_name, 'A user') || ' gave you a ' || NEW.rating || ' star rating.',
        'SUCCESS',
        NEW.job_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_reviewee ON reviews;
CREATE TRIGGER trg_notify_reviewee
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION notify_reviewee();

-- 3. AUTO-CALCULATE RATING TRIGGER
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
DECLARE
    v_target_id UUID;
    v_avg_rating NUMERIC;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_target_id := OLD.reviewee_id;
    ELSE
        v_target_id := NEW.reviewee_id;
    END IF;

    -- Calculate new average
    SELECT ROUND(AVG(rating), 1) INTO v_avg_rating
    FROM reviews
    WHERE reviewee_id = v_target_id;

    -- Update Profile
    UPDATE profiles 
    SET rating = COALESCE(v_avg_rating, 0)
    WHERE id = v_target_id;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_user_rating ON reviews;
CREATE TRIGGER trg_update_user_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_user_rating();

COMMIT;
