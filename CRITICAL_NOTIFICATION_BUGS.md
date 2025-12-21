# Critical Notification Bugs - Analysis & Fixes

## 🚨 CRITICAL ISSUES IDENTIFIED

### Issue 1: Chat Message Leak (SECURITY BUG)
**Problem**: Worker sees poster's message content in notifications BEFORE paying ₹50 chat fee

**Current Flow**:
1. Bid accepted → Worker selected but hasn't paid
2. Poster sends message
3. Chat notification shows message preview
4. Worker reads message without paying! ❌

**Impact**: Completely bypasses payment requirement

---

### Issue 2: Duplicate "Open Chat" Notifications
**Problem**: Worker gets TWO notifications to open chat when bid accepted

**Likely Cause**: 
- Bid acceptance trigger sends one
- Some other code sends another

---

### Issue 3: No Push Notifications for Bid Acceptance
**Problem**: Worker doesn't get push notification when bid accepted (only in-app)

**Likely Cause**: 
- LocalNotifications only work when app alive
- Need FCM for true background push
- OR app was in foreground

---

## ROOT CAUSE ANALYSIS

### Chat Notification Trigger (notify_on_new_message)

**Current Logic**:
```sql
-- Sends notification with message preview
INSERT INTO notifications (...)
VALUES (
  NEW.receiver_id, 
  'INFO', 
  'SenderName: JobTitle',
  LEFT(NEW.text, 60),  -- ❌ Shows message content!
  ...
);
```

**Missing**: Check if worker has paid before revealing message content!

---

## FIXES NEEDED

### Fix 1: Protect Chat Messages (CRITICAL)

Update `notify_on_new_message` trigger to:
1. Check if receiver has paid chat fee
2. If NOT paid: Send generic notification
3. If paid: Show message preview

**Logic**:
```sql
-- Check if receiver is worker who hasn't paid
DECLARE
  v_worker_paid BOOLEAN := FALSE;
  v_bid RECORD;
BEGIN
  -- Find the bid for this job
  SELECT * INTO v_bid 
  FROM bids 
  WHERE job_id = NEW.job_id 
    AND worker_id = NEW.receiver_id
    AND status = 'IN_PROGRESS';
  
  IF FOUND THEN
    v_worker_paid := (v_bid.connection_payment_status = 'PAID');
  END IF;
  
  -- If worker hasn't paid, hide message content
  IF NOT v_worker_paid AND NEW.receiver_id != v_job.poster_id THEN
    -- Generic notification
    INSERT INTO notifications (...)
    VALUES (
      NEW.receiver_id,
      'INFO',
      'Employer Ready to Chat 💬',
      'Unlock chat for ₹50 to discuss "' || v_job.title || '" details!',
      ...
    );
  ELSE
    -- Normal notification with preview
    INSERT INTO notifications (...)
    VALUES (
      NEW.receiver_id,
      'INFO',
      v_sender_name || ': ' || v_job.title,
      LEFT(NEW.text, 60),
      ...
    );
  END IF;
END;
```

---

### Fix 2: Remove Duplicate "Open Chat" Notification

**Check**: Bid acceptance trigger
- Currently sends "You're Hired! 🎉"
- Should NOT send second "Open Chat" notification

**Action**: Review `notify_on_bid_accept` - ensure it only sends ONE notification

---

### Fix 3: Push Notifications Not Working

**Current Status**:
- ✅ Triggers create notifications in DB
- ✅ Realtime broadcasts to in-app
- ❌ Push notifications require FCM webhook

**Temporary Fix**: Ensure app is in background
**Permanent Fix**: Add FCM webhook to triggers (Phase 3)

---

## SQL FIX SCRIPT

```sql
-- ============================================
-- FIX CHAT MESSAGE NOTIFICATION SECURITY
-- Prevent message leak before payment
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_sender_name TEXT;
  v_worker_paid BOOLEAN := FALSE;
  v_receiver_is_worker BOOLEAN := FALSE;
  v_bid RECORD;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;

  -- Check if receiver is the worker (not poster)
  SELECT * INTO v_bid 
  FROM bids 
  WHERE job_id = NEW.job_id 
    AND worker_id = NEW.receiver_id
    AND status = 'IN_PROGRESS';
  
  IF FOUND THEN
    v_receiver_is_worker := TRUE;
    v_worker_paid := (v_bid.connection_payment_status = 'PAID');
  END IF;

  -- SECURITY CHECK: If worker hasn't paid, don't show message content
  IF v_receiver_is_worker AND NOT v_worker_paid THEN
    -- Generic notification - hides message content
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      NEW.receiver_id, 
      'INFO', 
      'Employer Ready to Chat 💬',
      'Unlock chat to discuss "' || v_job.title || '" details. Tap to pay and start chatting!',
      NEW.job_id, 
      false, 
      NOW()
    );
  ELSE
    -- Normal notification with message preview (for poster or paid worker)
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      NEW.receiver_id, 
      'INFO', 
      COALESCE(v_sender_name, 'Someone') || ': ' || v_job.title,
      LEFT(NEW.text, 60) || CASE WHEN LENGTH(NEW.text) > 60 THEN '...' ELSE '' END,
      NEW.job_id, 
      false, 
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

## ADDITIONAL CHECKS NEEDED

### Check 1: Verify Bid Acceptance Sends Only ONE Notification

```sql
-- Review this function
SELECT prosrc FROM pg_proc WHERE proname = 'notify_on_bid_accept';
```

**Expected**: Should only insert ONE notification to worker

---

### Check 2: Verify Chat UI Respects Payment

**Frontend Check**: `ChatInterface.tsx` or `App.tsx`
- Should block chat UI if worker hasn't paid
- Should show payment prompt
- Should NOT show messages until paid

---

## TESTING PLAN

### Test 1: Chat Message Security
1. Poster accepts worker's bid
2. Worker does NOT pay ₹50
3. Poster sends message "When can you start?"
4. **Expected**: Worker gets "Employer Ready to Chat 💬 - Unlock chat to discuss..."
5. **NOT**: Worker should NOT see "When can you start?"

### Test 2: After Payment
1. Worker pays ₹50
2. Poster sends message "When can you start?"
3. **Expected**: Worker gets "PosterName: JobTitle - When can you start?"

### Test 3: Poster Always Sees Messages
1. Worker sends message (if paid)
2. **Expected**: Poster sees message preview
3. Posters don't pay, so always show content

---

## PRIORITY ORDER

1. **URGENT**: Fix chat message leak (security bug)
2. **HIGH**: Find and remove duplicate notification
3. **MEDIUM**: Investigate push notification issue (likely FCM needed)

---

## FILES TO UPDATE

1. `UPDATE_ALL_NOTIFICATIONS.sql` - Add fixed chat trigger
2. `CREATE_ALL_RPC_FUNCTIONS.sql` - Update if needed
3. Frontend: Verify chat UI blocks unpaid access
