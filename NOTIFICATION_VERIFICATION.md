# Notification System Verification Checklist

## CRITICAL: Run This SQL First!

**File**: `FINAL_NOTIFICATION_SYSTEM.sql`

This file contains ALL the notification triggers. You MUST run it in Supabase SQL Editor.

---

## Triggers That Should Exist After Running SQL

Run this query in Supabase to verify:
```sql
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND event_object_table IN ('bids', 'jobs', 'chat_messages')
ORDER BY event_object_table, trigger_name;
```

### Expected Triggers:

**On `bids` table:**
1. `on_bid_created_notify` - AFTER INSERT - Notifies poster of new bid
2. `trigger_notify_on_bid_accept` - AFTER UPDATE - Notifies workers when bid accepted
3. `trigger_notify_on_counter_offer` - AFTER UPDATE - Notifies opposite party on counter

**On `chat_messages` table:**
4. `notify_on_new_message` - AFTER INSERT - Notifies receiver of chat message

---

## Test Scenarios (After Running SQL)

### Test 1: New Bid Notification
**Steps**:
1. Worker opens app, places bid on poster's job
2. **Expected**: Poster gets in-app notification immediately
3. **Message**: "Rajesh placed a bid of ₹3500 on 'Job Title'"

**If it doesn't work**:
- Check if trigger `on_bid_created_notify` exists
- Check Supabase Realtime logs
- Verify notifications table RLS policies

---

### Test 2: Counter Offer (Poster → Worker)
**Steps**:
1. Poster opens ViewBidsModal
2. Poster sends counter offer to worker
3. **Expected**: Worker gets in-app notification
4. **Message**: "Customer countered with ₹3200 for 'Job Title'"

**If it doesn't work**:
- Check if trigger `trigger_notify_on_counter_offer` exists
- Verify `negotiation_history` has `by: 'POSTER'`
- Check notification was inserted into database

---

### Test 3: Counter Offer (Worker → Poster)  
**Steps**:
1. Worker receives counter, sends counter back
2. **Expected**: Poster gets notification
3. **Message**: "Rajesh countered with ₹3300 for 'Job Title'"

---

### Test 4: Bid Accepted
**Steps**:
1. Poster accepts a bid
2. **Expected**: 
   - Accepted worker gets "You're Hired! 🎉"
   - All other bidders get "Position Filled"

---

### Test 5: Chat Message
**Steps**:
1. Either party sends chat message
2. **Expected**: Other party gets notification with message preview

---

## Debugging Steps

### 1. Check if Triggers Exist
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name LIKE '%notif%';
```

### 2. Check Notifications Table
```sql
SELECT * FROM notifications 
ORDER BY created_at DESC 
LIMIT 10;
```

### 3. Check RLS Policies
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'notifications';
```

### 4. Test Trigger Manually
```sql
-- Insert a test bid (replace UUIDs with real ones)
INSERT INTO bids (job_id, worker_id, amount, status)
VALUES ('your-job-id', 'your-worker-id', 3500, 'PENDING');

-- Check if notification was created
SELECT * FROM notifications WHERE related_job_id = 'your-job-id';
```

---

## Common Issues

### Issue: "Notifications not appearing in app"
**Cause**: Realtime subscription not receiving events
**Fix**: Check Network tab, verify Realtime channel is connected

### Issue: "Trigger exists but notification not created"
**Cause**: Trigger error (check Supabase logs)
**Fix**: Look for errors in Supabase Dashboard → Database → Logs

### Issue: "Notification created but user doesn't see it"
**Cause**: RLS policy blocking SELECT
**Fix**: Run FINAL_NOTIFICATION_SYSTEM.sql to fix RLS policies

---

## Next Steps After Verification

1. If triggers are missing → Run `FINAL_NOTIFICATION_SYSTEM.sql`
2. If notifications aren't created → Check trigger logic/errors
3. If created but not visible → Fix RLS policies
4. If visible but not real-time → Check Realtime subscription

---

## Quick Fix: Run This Now

```sql
-- Copy entire FINAL_NOTIFICATION_SYSTEM.sql and paste here
-- This will create/update all triggers and RLS policies
```
