/*
  # CHOWKAR Database Schema Setup

  ## Overview
  Complete database schema for CHOWKAR - a hyperlocal labor marketplace connecting 
  service seekers (Posters) with daily wage workers in Tier-2/3 cities across India.

  ## Tables Created
  
  ### 1. profiles
  Extended user profiles with wallet, ratings, and preferences
  - Links to auth.users via user_id
  - Stores wallet balance, AI usage count, premium status
  - Contains location data (text and coordinates)
  - Tracks skills, experience, reviews
  
  ### 2. jobs
  Job postings created by posters
  - Contains job details (title, description, category, budget)
  - Tracks location with coordinates for distance-based search
  - Has status (OPEN, IN_PROGRESS, COMPLETED)
  - Links to poster profile
  - Supports optional job images
  
  ### 3. bids
  Worker bids on jobs with negotiation support
  - Links to both job and worker
  - Tracks bid amount and status
  - Contains message from worker
  - Stores negotiation history as JSONB
  
  ### 4. transactions
  Wallet transaction ledger
  - Links to user profile
  - Tracks credits and debits
  - Contains description and timestamp
  
  ### 5. notifications
  In-app notification system
  - Links to user profile
  - Can reference related job
  - Tracks read/unread status
  - Supports different notification types
  
  ### 6. chat_messages
  Chat between poster and hired worker
  - Links to job
  - Contains sender and message text
  - Supports translation feature
  
  ## Security
  - All tables have RLS enabled
  - Users can only access their own data
  - Job visibility controlled by status and ownership
  - Chat restricted to job participants
  
  ## Indexes
  - Indexes on foreign keys for performance
  - Composite indexes for common query patterns
*/

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  location text NOT NULL,
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  wallet_balance integer NOT NULL DEFAULT 0,
  rating decimal(3, 2) DEFAULT 5.0,
  profile_photo text,
  is_premium boolean DEFAULT false,
  ai_usage_count integer DEFAULT 0,
  bio text,
  skills text[] DEFAULT '{}',
  experience text,
  jobs_completed integer DEFAULT 0,
  join_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 2. JOBS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  poster_name text NOT NULL,
  poster_phone text NOT NULL,
  poster_photo text,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'Farm Labor', 'Construction', 'Plumbing', 'Electrical', 
    'Driver', 'Cleaning', 'Delivery', 'Other'
  )),
  location text NOT NULL,
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  job_date date NOT NULL,
  duration text NOT NULL,
  budget integer NOT NULL CHECK (budget > 0),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED')),
  accepted_bid_id uuid,
  image text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 3. BIDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  worker_name text NOT NULL,
  worker_phone text NOT NULL,
  worker_rating decimal(3, 2) NOT NULL,
  worker_location text NOT NULL,
  worker_latitude decimal(10, 8),
  worker_longitude decimal(11, 8),
  worker_photo text,
  amount integer NOT NULL CHECK (amount > 0),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  negotiation_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(job_id, worker_id)
);

-- =====================================================
-- 4. TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 5. NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR')),
  read boolean DEFAULT false,
  related_job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 6. CHAT_MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  translated_text text,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 7. REVIEWS TABLE (for user reviews)
-- =====================================================
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_lat_lng ON profiles(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Jobs indexes
CREATE INDEX IF NOT EXISTS idx_jobs_poster_id ON jobs(poster_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_lat_lng ON jobs(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Bids indexes
CREATE INDEX IF NOT EXISTS idx_bids_job_id ON bids(job_id);
CREATE INDEX IF NOT EXISTS idx_bids_worker_id ON bids(worker_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Chat messages indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_job_id ON chat_messages(job_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_job_id ON reviews(job_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- JOBS POLICIES
-- =====================================================

CREATE POLICY "Anyone can view open jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    status = 'OPEN' OR 
    poster_id = auth.uid() OR 
    id IN (SELECT job_id FROM bids WHERE worker_id = auth.uid())
  );

CREATE POLICY "Posters can insert jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (poster_id = auth.uid());

CREATE POLICY "Posters can update own jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (poster_id = auth.uid())
  WITH CHECK (poster_id = auth.uid());

CREATE POLICY "Posters can delete own jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (poster_id = auth.uid() AND status = 'OPEN');

-- =====================================================
-- BIDS POLICIES
-- =====================================================

CREATE POLICY "Workers can view own bids"
  ON bids FOR SELECT
  TO authenticated
  USING (
    worker_id = auth.uid() OR 
    job_id IN (SELECT id FROM jobs WHERE poster_id = auth.uid())
  );

CREATE POLICY "Workers can create bids"
  ON bids FOR INSERT
  TO authenticated
  WITH CHECK (
    worker_id = auth.uid() AND
    EXISTS (SELECT 1 FROM jobs WHERE id = job_id AND status = 'OPEN')
  );

CREATE POLICY "Workers can update own bids"
  ON bids FOR UPDATE
  TO authenticated
  USING (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Poster can update bids on their jobs"
  ON bids FOR UPDATE
  TO authenticated
  USING (job_id IN (SELECT id FROM jobs WHERE poster_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE poster_id = auth.uid()));

-- =====================================================
-- TRANSACTIONS POLICIES
-- =====================================================

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- NOTIFICATIONS POLICIES
-- =====================================================

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- CHAT_MESSAGES POLICIES
-- =====================================================

CREATE POLICY "Job participants can view chat"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid() OR
    job_id IN (
      SELECT id FROM jobs WHERE poster_id = auth.uid() OR accepted_bid_id IN (
        SELECT id FROM bids WHERE worker_id = auth.uid()
      )
    )
  );

CREATE POLICY "Job participants can send messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    job_id IN (
      SELECT id FROM jobs WHERE 
        poster_id = auth.uid() OR 
        accepted_bid_id IN (SELECT id FROM bids WHERE worker_id = auth.uid())
    )
  );

-- =====================================================
-- REVIEWS POLICIES
-- =====================================================

CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bids_updated_at BEFORE UPDATE ON bids
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate distance between two points (in km) using Haversine formula
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 decimal, lon1 decimal, lat2 decimal, lon2 decimal
)
RETURNS decimal AS $$
DECLARE
  earth_radius constant decimal := 6371; -- Earth's radius in km
  dlat decimal;
  dlon decimal;
  a decimal;
  c decimal;
BEGIN
  -- Handle NULL values
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Convert degrees to radians
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  -- Haversine formula
  a := sin(dlat/2) * sin(dlat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
