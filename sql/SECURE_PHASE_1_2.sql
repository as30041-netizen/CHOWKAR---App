-- Phase 1: Security & Data (Wallet)
-- 1. Create secure RPC function for wallet transactions
CREATE OR REPLACE FUNCTION process_transaction(
  p_amount INTEGER, -- Changed to INTEGER to match table schema
  p_type TEXT,
  p_description TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_new_balance INTEGER;
  v_tx_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate inputs
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Perform Transaction logic
  IF p_type = 'DEBIT' THEN
     -- Check sufficient funds
     SELECT wallet_balance INTO v_new_balance FROM profiles WHERE id = v_user_id;
     IF v_new_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient funds';
     END IF;
     
     UPDATE profiles 
     SET wallet_balance = wallet_balance - p_amount
     WHERE id = v_user_id
     RETURNING wallet_balance INTO v_new_balance;
     
  ELSIF p_type = 'CREDIT' THEN
     UPDATE profiles 
     SET wallet_balance = wallet_balance + p_amount
     WHERE id = v_user_id
     RETURNING wallet_balance INTO v_new_balance;
  ELSE
     RAISE EXCEPTION 'Invalid transaction type';
  END IF;

  -- Insert transaction record
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (v_user_id, p_amount, p_type, p_description)
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'new_balance', v_new_balance,
    'transaction_id', v_tx_id
  );
END;
$$;

-- 2. Prevent direct updates to wallet_balance via API
CREATE OR REPLACE FUNCTION prevent_wallet_balance_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow updates if they come from a Security Definer function (like process_transaction)
  -- But block if they come directly from the authenticated user via API.
  -- The simplest way to detect direct API update is checking if the current role is 'authenticated' 
  -- AND we are in the context of an API call.
  
  -- However, inside a SECURITY DEFINER function, current_user is the owner (e.g. postgres).
  -- When called via API directly, current_user is 'authenticated' (or the user's role).
  
  IF (OLD.wallet_balance IS DISTINCT FROM NEW.wallet_balance) 
     AND (current_user = 'authenticated' OR current_user = 'anon') THEN
      RAISE EXCEPTION 'Direct updates to wallet_balance are not allowed. Use process_transaction() instead.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_wallet_update ON profiles;
CREATE TRIGGER trg_prevent_wallet_update
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_wallet_balance_update();


-- Phase 2: Lifecycle UX (Notifications & Chat)

-- 3. Add soft delete columns
-- Start a transaction block implicitly by running statements
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'deleted_at') THEN
        ALTER TABLE notifications ADD COLUMN deleted_at timestamptz DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'deleted_at') THEN
        ALTER TABLE chat_messages ADD COLUMN deleted_at timestamptz DEFAULT NULL;
    END IF;
END $$;

-- 4. RPCs for Notifications

-- Soft Delete Single Notification
CREATE OR REPLACE FUNCTION soft_delete_notification(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow if own notification
  UPDATE notifications
  SET deleted_at = now()
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;

-- Clear All Notifications (Soft Delete All for User)
CREATE OR REPLACE FUNCTION clear_all_notifications()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications
  SET deleted_at = now()
  WHERE user_id = auth.uid() AND deleted_at IS NULL;
END;
$$;

-- Mark All As Read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications
  SET read = true
  WHERE user_id = auth.uid() AND read = false;
END;
$$;

-- 5. RPC for Chat

-- Soft Delete Chat Message
CREATE OR REPLACE FUNCTION soft_delete_chat_message(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE chat_messages
  SET deleted_at = now()
  WHERE id = p_message_id AND sender_id = auth.uid();
END;
$$;

-- 6. Update Policies to exclude deleted items
-- Note: We can't easily alter existing policies without dropping them. 
-- For now, the Frontend should filter `deleted_at IS NULL`.
-- But ideally we should update the policies.
-- Let's try to update the "Users can view own notifications" policy if we can, but it might be complex to script blindly.
-- For now, let's rely on frontend filtering + new view logic if needed. 
-- Ideally, we create a VIEW or update the SELECT policy.
-- Let's add a policy condition.

-- Drop existing select policy for notifications and recreate it
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- Drop existing select policy for chat messages and recreate it
-- Actually chat messages logic is complex (participants), so let's just append the condition.
-- Original:
-- USING (
--     sender_id = auth.uid() OR
--     job_id IN (...)
-- )
-- We want to hide deleted messages. But wait, if I delete a message, should it be hidden from the other person too? 
-- Usually "Delete for everyone" vs "Delete for me". 
-- The logic above `soft_delete_chat_message` just marks it deleted.
-- If `deleted_at` is set, it's generally "Delete for everyone" in this simple model if we filter it out globally.
-- The requirement says "Delete Message (Soft delete)".
-- Let's assume it should be hidden from view.
DROP POLICY IF EXISTS "Job participants can view chat" ON chat_messages;
CREATE POLICY "Job participants can view chat"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    (deleted_at IS NULL) AND
    (
      sender_id = auth.uid() OR
      job_id IN (
        SELECT id FROM jobs WHERE poster_id = auth.uid() OR accepted_bid_id IN (
          SELECT id FROM bids WHERE worker_id = auth.uid()
        )
      )
    )
  );
