# Notification System Comprehensive Test Plan

## Test Environment Setup

### Prerequisites
- ✅ FINAL_NOTIFICATION_SYSTEM.sql executed
- ✅ CREATE_ALL_RPC_FUNCTIONS.sql executed  
- ✅ Latest APK installed on Android device
- ✅ Web app deployed to chowkar.in
- Test with 2 accounts: **Poster** and **Worker**

---

## Part 1: BIDDING NOTIFICATIONS

### Test 1.1: New Bid (Worker → Poster)
**Setup**: Worker bids ₹3500 on poster's job

**Expected Behavior**:

| App State | In-App Toast | System Push | Badge Count |
|-----------|--------------|-------------|-------------|
| **Poster Foreground** | ✅ Shows | ❌ No | +1 |
| **Poster Background** | ✅ Yes | ✅ Shows | +1 |
| **Poster Killed** | ❌ No | ✅ Shows | +1 (on open) |

**Notification Content**:
```
Title: New Bid: ₹3500 🔔
Message: [WorkerName] wants to work on "[JobTitle]". Review their bid and profile now!
```

**Tap Action**: Opens ViewBidsModal for that job

**Verify**:
- [ ] Toast appears instantly (foreground)
- [ ] Push notification shows (background/killed)
- [ ] Tapping opens ViewBidsModal
- [ ] Badge count increases by 1
- [ ] Notification marked as read after viewing

---

### Test 1.2: Counter Offer - Poster → Worker
**Setup**: Poster sends counter ₹3200 (was ₹3500)

**Expected**:
- Worker gets notification (even if app killed)
- Message shows old vs new price

**Notification Content**:
```
Title: Employer Countered! 💬
Message: New offer: ₹3200 for "[JobTitle]" (was ₹3500). Accept, reject, or counter back!
```

**Verify**:
- [ ] Worker receives notification
- [ ] Shows both amounts (₹3500 → ₹3200)
- [ ] Tap opens ViewBidsModal (My Bids section)
- [ ] Counter offer highlighted

---

### Test 1.3: Counter Offer - Worker → Poster  
**Setup**: Worker counters back ₹3300

**Expected**: Poster gets notification

**Notification Content**:
```
Title: [WorkerName] Countered 💬
Message: New bid: ₹3300 for "[JobTitle]" (was ₹3200). Accept or counter back!
```

**Verify**:
- [ ] Poster receives in-app + push
- [ ] Message contextual
- [ ] Tap opens ViewBidsModal

---

### Test 1.4: Bid Accepted - Winner
**Setup**: Poster accepts worker's bid

**Notification Content**:
```
Title: You're Hired! 🎉
Message: [PosterName] is waiting to discuss "[JobTitle]" with you. Chat now to lock in the ₹3300 work!
```

**Verify**:
- [ ] Worker gets excited message
- [ ] No mention of ₹50 payment
- [ ] Tap shows job details + payment UI
- [ ] Badge count +1

---

### Test 1.5: Bid Accepted - Other Bidders
**Setup**: Same as 1.4

**Expected**: All OTHER pending bidders get notification

**Notification Content**:
```
Title: Position Filled
Message: "[JobTitle]" hired another worker. Keep browsing for more opportunities!
```

**Verify**:
- [ ] All pending bidders notified
- [ ] Accepted worker NOT in this list
- [ ] Message encouraging, not discouraging

---

## Part 2: CHAT NOTIFICATIONS

### Test 2.1: New Message (Poster → Worker)
**Setup**: Poster sends "When can you start?"

**Notification Content**:
```
Title: [PosterName]: [JobTitle]
Message: When can you start?
```

**Special Rule**: Suppress if worker is viewing THIS chat

**Verify**:
- [ ] Worker gets notification
- [ ] Shows first 60 chars of message
- [ ] NO notification if already in chat
- [ ] Tap opens chat for that job
- [ ] Auto-marks chat notifications as read

---

### Test 2.2: New Message (Worker → Poster)
**Setup**: Worker replies "Tomorrow morning"

**Same as 2.1 but for poster**

---

## Part 3: JOB LIFECYCLE

### Test 3.1: Job Cancelled - Accepted Worker (Paid)
**Setup**: 
1. Worker paid ₹50 chat fee
2. Poster cancels job

**Notification Content**:
```
Title: Job Cancelled ⚠️
Message: "[JobTitle]" was cancelled. Your ₹50 chat fee has been refunded to your wallet.
```

**Verify**:
- [ ] Worker gets notification
- [ ] ₹50 added to wallet_balance
- [ ] Shows actual refund amount (from app_config)
- [ ] Tap goes to wallet

---

### Test 3.2: Job Cancelled - Accepted Worker (Not Paid)
**Setup**: Worker selected but didn't pay yet

**Notification Content**:
```
Title: Job Cancelled ⚠️
Message: "[JobTitle]" was cancelled by the employer.
```

**Verify**:
- [ ] Worker gets notification
- [ ] NO refund (didn't pay)
- [ ] Message different from 3.1

---

### Test 3.3: Job Cancelled - Pending Bidders
**Setup**: Same cancellation

**Notification Content**:
```
Title: Job No Longer Available
Message: "[JobTitle]" was cancelled. Keep browsing for similar opportunities!
```

**Verify**:
- [ ] All pending bidders notified
- [ ] Brief, non-alarming message

---

## Part 4: BADGE COUNTER

### Test 4.1: Badge Increment
**Setup**: Send 3 notifications to user

**Verify**:
- [ ] Badge shows "3"
- [ ] Badge visible on Home icon
- [ ] Badge visible on Notifications button

---

### Test 4.2: Badge Decrement
**Setup**: User opens notification panel, reads 2 notifications

**Verify**:
- [ ] Badge decreases to "1"
- [ ] Badge updates in real-time
- [ ] Badge disappears when all read

---

### Test 4.3: Badge on App Icon (Mobile)
**Verify**:
- [ ] Android app icon shows badge count
- [ ] Badge clears when app opened
- [ ] Badge persists across app restarts

---

## Part 5: FOREGROUND vs BACKGROUND

### Test 5.1: Foreground Suppression
**Setup**: 
1. User has app open on Home page
2. Send notification

**Verify**:
- [ ] In-app toast appears
- [ ] NO system tray push notification
- [ ] `shouldSendPushNotification()` returns false

---

### Test 5.2: Background Push
**Setup**:
1. User minimizes app (Home button)
2. Send notification

**Verify**:
- [ ] System tray notification appears
- [ ] In-app notification created (visible when reopened)
- [ ] Both delivered

---

### Test 5.3: Killed App Push
**Setup**:
1. User force-closes app
2. Send notification

**Verify**:
- [ ] System push notification appears
- [ ] Notification stored in DB
- [ ] Appears in-app when user reopens

---

## Part 6: WEB APP SPECIFIC

### Test 6.1: Browser Notifications
**Setup**: User on chowkar.in with notifications enabled

**Verify**:
- [ ] Browser asks for notification permission
- [ ] Notifications appear as browser notifications
- [ ] Tap navigates to correct page
- [ ] Badge count updates

---

### Test 6.2: Multiple Tabs
**Setup**: User has 2 tabs of chowkar.in open

**Verify**:
- [ ] Notification appears in both tabs
- [ ] Badge syncs across tabs
- [ ] No duplicate notifications

---

## Part 7: EDGE CASES

### Test 7.1: Rapid Fire
**Setup**: Worker sends 5 counter offers quickly

**Verify**:
- [ ] All 5 notifications created
- [ ] No duplicates
- [ ] No missed notifications
- [ ] Order preserved (newest first)

---

### Test 7.2: Offline → Online
**Setup**:
1. Worker goes offline
2. Poster sends 3 notifications
3. Worker comes online

**Verify**:
- [ ] Worker receives all 3 when online
- [ ] All delivered via Supabase Realtime
- [ ] Badge count accurate

---

### Test 7.3: Permission Denied
**Setup**: User denies notification permission

**Verify**:
- [ ] In-app toast still works
- [ ] No system push
- [ ] No errors in console
- [ ] App still functional

---

## Part 8: NOTIFICATION METADATA

### Test 8.1: Tap Payload
**Setup**: Tap any notification

**Verify**:
- [ ] `extra.jobId` present
- [ ] `extra.type` present
- [ ] `extra.notificationId` present
- [ ] Navigation uses correct data

---

### Test 8.2: Deep Linking
**Setup**: App killed, tap notification

**Verify**:
- [ ] App opens
- [ ] Loads job data
- [ ] Opens correct modal/screen
- [ ] Marks notification as read

---

## Part 9: DATABASE VERIFICATION

### Test 9.1: Check Triggers
```sql
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND event_object_table IN ('bids', 'jobs', 'chat_messages');
```

**Expected**: 4 triggers
- `on_bid_created_notify` (bids, INSERT)
- `trigger_notify_on_counter_offer` (bids, UPDATE)
- `trigger_notify_on_bid_accept` (bids, UPDATE)
- `notify_on_new_message` (chat_messages, INSERT)

---

### Test 9.2: Check RLS Policies
```sql
SELECT * FROM pg_policies WHERE tablename = 'notifications';
```

**Expected**: 2 policies
- Users can view own notifications (SELECT)
- Users can update own notifications (UPDATE)

---

### Test 9.3: Check Notifications Table
```sql
SELECT type, title, LEFT(message, 50), related_job_id, read 
FROM notifications 
ORDER BY created_at DESC 
LIMIT 20;
```

**Verify**:
- [ ] Notifications inserted correctly
- [ ] `related_job_id` populated
- [ ] `type` correct (INFO, SUCCESS, WARNING)
- [ ] `read` defaults to false

---

## Part 10: PERFORMANCE

### Test 10.1: Notification Delivery Speed
**Setup**: Worker posts bid

**Verify**:
- [ ] Poster sees notification <100ms
- [ ] No lag in UI
- [ ] Real-time feels instant

---

### Test 10.2: Large Notification List
**Setup**: User has 100+ notifications

**Verify**:
- [ ] App doesn't slow down
- [ ] List scrolls smoothly
- [ ] Only 100 stored (limit enforced)

---

## SUMMARY CHECKLIST

### Must Work
- [x] SQL triggers executed (FINAL_NOTIFICATION_SYSTEM.sql)
- [ ] New bid → Poster notified
- [ ] Counter offer → Opposite party notified
- [ ] Bid accept → Winner + others notified
- [ ] Chat message → Receiver notified
- [ ] Job cancel → All parties notified + refund
- [ ] Foreground = toast only
- [ ] Background = toast + push
- [ ] Killed = push only
- [ ] Badge counter accurate
- [ ] Tap navigation works
- [ ] Web notifications work
- [ ] Mobile notifications work

### Known Limitations
- ⚠️ FCM needed for true background push when app killed (current: LocalNotifications only work when app alive)
- ⚠️ iOS requires different setup (currently Android-focused)

---

## If Something Doesn't Work

1. **Check Console Logs**: Look for `[Realtime]`, `[Push]`, `[Tap]` logs
2. **Check Supabase Logs**: Database → Logs → Look for trigger errors
3. **Check Network Tab**: Verify Realtime connection active
4. **Run SQL Queries**: Verify notifications inserted
5. **Check RLS**: Ensure policies allow SELECT

---

## Next Steps After Testing

1. Document what works ✅
2. Document what doesn't ❌
3. Prioritize fixes
4. Consider FCM integration for killed app push
