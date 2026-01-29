-- ==========================================
-- AUTO-NOTIFY ON PLAN CHANGE
-- Description: Automatically sends a notification to users when their plan changes
--              with custom messages for upgrades, downgrades, and renewals
-- ==========================================

BEGIN;

-- Create function to send plan change notification
CREATE OR REPLACE FUNCTION notify_plan_change()
RETURNS TRIGGER AS $$
DECLARE
    plan_message TEXT;
    plan_title TEXT;
    old_plan TEXT;
    new_plan TEXT;
BEGIN
    -- Only trigger if subscription_plan actually changed
    IF OLD.subscription_plan IS DISTINCT FROM NEW.subscription_plan THEN
        old_plan := COALESCE(OLD.subscription_plan, 'FREE');
        new_plan := COALESCE(NEW.subscription_plan, 'FREE');
        
        -- Determine if upgrade or downgrade
        CASE 
            -- UPGRADES
            WHEN old_plan = 'FREE' AND new_plan = 'WORKER_PLUS' THEN
                plan_title := '🚀 Welcome to Worker Plus!';
                plan_message := 'You now have UNLIMITED BIDS! Start applying to unlimited jobs. Zero commission on all your work.';
            
            WHEN old_plan = 'FREE' AND new_plan = 'PRO_POSTER' THEN
                plan_title := '👑 Welcome to Pro Poster!';
                plan_message := 'You can now post UNLIMITED JOBS! Plus, use AI Job Enhancer and Wage Estimator for best results.';
            
            WHEN old_plan = 'FREE' AND new_plan = 'SUPER' THEN
                plan_title := '⭐ Welcome to SUPER!';
                plan_message := 'You''ve unlocked EVERYTHING! Unlimited posts, unlimited bids, and full AI power. Dominate the marketplace!';
            
            WHEN old_plan = 'WORKER_PLUS' AND new_plan = 'SUPER' THEN
                plan_title := '⭐ Upgraded to SUPER!';
                plan_message := 'You now have unlimited job posting and AI tools in addition to unlimited bids. You''re unstoppable!';
            
            WHEN old_plan = 'PRO_POSTER' AND new_plan = 'SUPER' THEN
                plan_title := '⭐ Upgraded to SUPER!';
                plan_message := 'You now have unlimited bidding power in addition to unlimited posting and AI. Complete freedom!';
            
            -- DOWNGRADES
            WHEN new_plan = 'FREE' THEN
                plan_title := '📋 Plan Changed';
                plan_message := 'Your plan has been changed to Free tier. You have 3 posts/month and 5 bids/week. Upgrade anytime for unlimited access!';
            
            WHEN old_plan = 'SUPER' AND new_plan = 'WORKER_PLUS' THEN
                plan_title := '📋 Plan Updated';
                plan_message := 'Your plan is now Worker Plus. You still have unlimited bids, but posting is limited to 3/month.';
            
            WHEN old_plan = 'SUPER' AND new_plan = 'PRO_POSTER' THEN
                plan_title := '📋 Plan Updated';
                plan_message := 'Your plan is now Pro Poster. You have unlimited posts + AI, but bidding is limited to 5/week.';
            
            -- LATERAL MOVES
            WHEN old_plan = 'WORKER_PLUS' AND new_plan = 'PRO_POSTER' THEN
                plan_title := '🔄 Plan Changed';
                plan_message := 'Switched to Pro Poster! You now have unlimited posting + AI tools. Bidding is limited to 5/week.';
            
            WHEN old_plan = 'PRO_POSTER' AND new_plan = 'WORKER_PLUS' THEN
                plan_title := '🔄 Plan Changed';
                plan_message := 'Switched to Worker Plus! You now have unlimited bidding. Job posting is limited to 3/month.';
            
            ELSE
                plan_title := '📋 Subscription Updated';
                plan_message := 'Your subscription plan has been updated. Check your profile for details.';
        END CASE;
        
        -- Insert notification
        INSERT INTO public.notifications (user_id, title, message, type, created_at)
        VALUES (NEW.id, plan_title, plan_message, 'SYSTEM', NOW());
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_plan_change_notification ON public.profiles;

-- Create trigger
CREATE TRIGGER trigger_plan_change_notification
    AFTER UPDATE OF subscription_plan ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION notify_plan_change();

COMMIT;
