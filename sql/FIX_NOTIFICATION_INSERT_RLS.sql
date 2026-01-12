-- Allow authenticated users to insert notifications for ANY user
-- This is critical for users to notify each other (e.g. Bid Received, Counter Offer)

-- 1. Drop partial/restrictive insert policies
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."notifications";
DROP POLICY IF EXISTS "notif_insert_any" ON "public"."notifications";
DROP POLICY IF EXISTS "Users can insert notifications" ON "public"."notifications";
DROP POLICY IF EXISTS "Users can create notifications" ON "public"."notifications";

-- 2. Create permissive insert policy
DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON "public"."notifications";
CREATE POLICY "Enable insert for all authenticated users"
ON "public"."notifications"
FOR INSERT
TO authenticated
WITH CHECK (true);  -- Allow authenticated users to insert rows for ANY user_id

-- 3. Ensure Select/Update is still safe (User can only see/edit their own)
DROP POLICY IF EXISTS "Anyone can read own notifications" ON "public"."notifications";
DROP POLICY IF EXISTS "Users can view own notifications" ON "public"."notifications";

CREATE POLICY "Users can view own notifications"
ON "public"."notifications"
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON "public"."notifications";

CREATE POLICY "Users can update own notifications"
ON "public"."notifications"
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
