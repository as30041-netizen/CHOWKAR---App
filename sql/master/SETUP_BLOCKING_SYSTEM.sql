-- ============================================
-- USER BLOCKING SYSTEM
-- ============================================
-- 1. Create blocked_users table
-- 2. RLS Policies
-- 3. RPC functions for easy frontend access
-- ============================================

-- 1. Create Table
CREATE TABLE IF NOT EXISTS user_blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- 2. Enable RLS
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Users can see who they blocked
CREATE POLICY "Users can view their own blocks" 
ON user_blocks FOR SELECT 
USING (auth.uid() = blocker_id);

-- Users can delete their own blocks (unblock)
CREATE POLICY "Users can delete their own blocks" 
ON user_blocks FOR DELETE 
USING (auth.uid() = blocker_id);

-- Users can insert their own blocks
CREATE POLICY "Users can create blocks" 
ON user_blocks FOR INSERT 
WITH CHECK (auth.uid() = blocker_id);

-- ============================================
-- RPC Functions
-- ============================================

-- BLOCK USER
CREATE OR REPLACE FUNCTION block_user(p_blocked_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_blocked_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot block yourself';
  END IF;

  INSERT INTO user_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
END;
$$;

-- UNBLOCK USER
CREATE OR REPLACE FUNCTION unblock_user(p_blocked_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM user_blocks
  WHERE blocker_id = auth.uid() AND blocked_id = p_blocked_id;
END;
$$;

-- CHECK IF BLOCKED (Bidirectional check: Am I blocked OR did I block?)
-- Useful to hide chat input or show "User Unavailable"
CREATE OR REPLACE FUNCTION check_relationship_status(p_other_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_i_blocked BOOLEAN;
  v_they_blocked_me BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM user_blocks 
    WHERE blocker_id = auth.uid() AND blocked_id = p_other_user_id
  ) INTO v_i_blocked;

  SELECT EXISTS(
    SELECT 1 FROM user_blocks 
    WHERE blocker_id = p_other_user_id AND blocked_id = auth.uid()
  ) INTO v_they_blocked_me;

  RETURN json_build_object(
    'i_blocked', v_i_blocked,
    'they_blocked_me', v_they_blocked_me
  );
END;
$$;
