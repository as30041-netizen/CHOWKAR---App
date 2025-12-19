# 🧪 CHOWKAR App Testing Guide

## Pre-Testing Checklist
- [ ] **RUN_THIS_FINAL_SYNC.sql** executed in Supabase SQL Editor
- [ ] No errors in SQL execution
- [ ] Database tables verified (see below)

---

## 📊 Database Verification

Run these queries in Supabase SQL Editor to confirm setup:

```sql
-- 1. Verify chat_messages has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
AND column_name IN ('read', 'read_at', 'media_type', 'media_url', 'media_duration');
-- Expected: 5 rows

-- 2. Verify RPC functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_type = 'FUNCTION' 
AND routine_schema = 'public'
AND routine_name IN ('mark_messages_read', 'charge_commission', 'cancel_job_with_refund', 'archive_chat', 'unarchive_chat', 'delete_chat');
-- Expected: 6 rows

-- 3. Check chats table exists (for archive feature)
SELECT table_name FROM information_schema.tables WHERE table_name = 'chats';
-- Expected: 1 row
```

If any queries return fewer rows than expected, review the SQL script output for errors.

---

## 🔍 Manual Testing Workflow

### Test 1: Job Posting with Payment ⭐ CRITICAL
**Objective:** Verify job posting works after phone NULL constraint fix

**Steps:**
1. Open app → Switch to "Hire / My Jobs" mode
2. Click "Post Job" button
3. Fill in all required fields:
   - Title: "Test Plumbing Job"
   - Category: Select any
   - Description: Add test description
   - Date: Tomorrow's date
   - Budget: ₹500
4. Click "Attach Location" (grant permission if needed)
5. Click "Post Job (₹10)"

**Expected Results:**
- ✅ If wallet balance ≥ ₹10: Job posts immediately, balance deducted
- ✅ If wallet balance < ₹10: Payment modal appears (Razorpay test mode)
- ✅ After payment: Job appears in "My Jobs" dashboard
- ✅ Notification: "Job Posted: 'Test Plumbing Job' is now live!"

**Common Issues:**
- ❌ "null value in column poster_phone violates not-null constraint" → FIX_PHONE_NULL_CONSTRAINT.sql not run
- ❌ Payment hangs → Check browser console for errors

---

### Test 2: Worker Bidding on Job
**Objective:** Verify multiple workers can bid without constraint errors

**Steps:**
1. Switch to "Find Work" mode
2. Find the test job you just posted
3. Click on the job card
4. Click "Place Bid"
5. Enter bid amount: ₹450
6. Add message: "I can do this job"
7. Click "Submit Bid"
8. **[Repeat with a different test account if possible]**

**Expected Results:**
- ✅ Bid appears in job details under "Bids" tab
- ✅ Poster receives notification: "New bid on 'Test Plumbing Job'"
- ✅ Second worker can also bid without errors

**Common Issues:**
- ❌ INSERT failed on bids → Check RLS policies

---

### Test 3: Accept Bid & Commission Charge ⭐ CRITICAL
**Objective:** Verify platform fee is charged via secure RPC

**Steps:**
1. Switch to "Hire / My Jobs" mode
2. Open the test job
3. Click "View Bids"
4. Click "Accept" on a bid
5. Confirm acceptance

**Expected Results:**
- ✅ Job status changes to "In Progress"
- ✅ Worker's wallet balance decreases by 5% (₹22.50 for ₹450 bid)
- ✅ Transaction appears in worker's wallet: "Platform Fee (5%)"
- ✅ Chat interface opens automatically
- ✅ Both users can see each other's phone numbers now

**Common Issues:**
- ❌ Commission not charged → `charge_commission` RPC failed
- ❌ Direct wallet update error → `process_transaction` security blocking it

---

### Test 4: Chat & Read Receipts
**Objective:** Verify chat enhancements work

**Steps:**
1. In the chat interface, send a message: "Hello"
2. Switch to the other user account (or use another device)
3. Open the same chat
4. Observe the message

**Expected Results:**
- ✅ Sender sees single checkmark (✓) initially
- ✅ When receiver opens chat, sender sees double checkmark (✓✓)
- ✅ Receiver can see "read" status in UI
- ✅ Realtime updates (message appears instantly without refresh)

**Common Issues:**
- ❌ Read receipts not updating → `mark_messages_read` RPC issue
- ❌ Messages not syncing → Check Realtime subscription in browser console

---

### Test 5: Job Cancellation with Notifications ⭐ CRITICAL
**Objective:** Verify enhanced cancellation sends notifications

**Steps:**
1. As the job poster, go to "My Jobs"
2. Open a job (preferably one with bids)
3. Click "Cancel Job"
4. Confirm cancellation

**Expected Results:**
- ✅ Job status changes to "CANCELLED"
- ✅ Poster receives notification: "Job Cancelled: Your job..."
- ✅ All bidders receive notification: "Job Cancelled: The job you bid on..."
- ✅ If job was IN_PROGRESS, worker receives refund notification

**Common Issues:**
- ❌ No notifications → `cancel_job_with_refund` function issue
- ❌ Notifications only appear after refresh → Realtime listener not working

---

### Test 6: Chat Archive/Delete
**Objective:** Verify chat lifecycle management

**Steps:**
1. Open "Messages" panel
2. Swipe or click menu (⋮) on a chat
3. Click "Archive"
4. Toggle "Show Archived" switch
5. Verify chat appears in archived section
6. Click "Unarchive"
7. Click menu again → "Delete"

**Expected Results:**
- ✅ Archived chats move to separate section
- ✅ Unarchive brings them back
- ✅ Delete removes chat from inbox (soft delete)
- ✅ Chat persists in database for the other user

**Common Issues:**
- ❌ Archive doesn't work → `archive_chat` RPC issue
- ❌ Chats table missing → Run CHAT_ENHANCEMENTS.sql first

---

### Test 7: Wallet Security ⭐ CRITICAL
**Objective:** Verify direct wallet manipulation is blocked

**Steps:**
1. Open browser console (F12)
2. Try to execute: 
```javascript
await supabase.from('profiles').update({ wallet_balance: 99999 }).eq('id', '<your-user-id>')
```

**Expected Results:**
- ✅ Update fails with security error
- ✅ Console shows: "Direct updates to wallet_balance are not allowed"
- ✅ Balance remains unchanged

**Common Issues:**
- ❌ Update succeeds → SECURITY_AUDIT_PHASE2.sql trigger not active

---

### Test 8: Add Money (Test Mode)
**Objective:** Verify wallet top-up works

**Steps:**
1. Open "Wallet" page
2. Click "Add Money"
3. Enter amount: ₹100
4. Click "Add Money (Test Mode)" button

**Expected Results:**
- ✅ Balance increases by ₹100
- ✅ Transaction recorded: "Test Mode - Add Money"
- ✅ Realtime balance update (no refresh needed)

**Common Issues:**
- ❌ "Direct wallet credits not allowed" → `process_transaction` blocking test mode
- ❌ Payment modal doesn't open → Check Razorpay key configuration

---

## 🎯 Performance & UX Tests

### Test 9: Notification Delivery Speed
1. Accept a bid
2. Observe notification arrival time on worker's device
3. **Expected:** < 2 seconds (via broadcast channel)

### Test 10: Mobile Responsiveness
1. Resize browser window to mobile size (375px width)
2. Test all major flows
3. **Expected:** No horizontal scroll, all buttons clickable

### Test 11: Offline Behavior
1. Turn off Wi-Fi
2. Try to post a job
3. **Expected:** Graceful error message, no app crash

---

## 🐛 Known Issues & Workarounds

| Issue | Workaround | Status |
|-------|-----------|--------|
| TypeScript errors in Edge Functions | IDE-only, doesn't affect build | ✅ Safe to ignore |
| Phone number not visible for OPEN jobs | By design (privacy) | ✅ Feature |
| "Second worker bid" error | Fixed via RLS policy update | ✅ Resolved |

---

## 📱 APK Build Testing (After Manual Tests Pass)

### Build Commands
```bash
# 1. Sync Capacitor
npm run cap:sync

# 2. Build Android
npm run cap:build

# 3. Compile APK
cd android
.\gradlew assembleDebug

# APK Location:
# android\app\build\outputs\apk\debug\app-debug.apk
```

### APK Installation Testing
1. Transfer APK to Android device
2. Install and open app
3. **Test on real device:**
   - Push notifications
   - Camera permissions (for job photos)
   - Location permissions
   - OAuth sign-in flow

---

## ✅ Sign-Off Checklist

Before deploying to production:

- [ ] All 8 manual tests passed
- [ ] No console errors during testing
- [ ] Database verification queries passed
- [ ] APK built successfully
- [ ] APK tested on real Android device
- [ ] All critical workflows (⭐) verified
- [ ] Performance acceptable (< 3s job posting, < 2s notifications)

---

## 🆘 Troubleshooting

### General Debugging Steps:
1. Check browser console for errors (F12)
2. Check Supabase logs: Dashboard → Logs → API
3. Check Realtime Inspector: Dashboard → Realtime
4. Verify RLS policies: Dashboard → Database → Policies

### Error Reference:
- **"Function does not exist"** → SQL script not run
- **"Insufficient permissions"** → RLS policy blocking access
- **"Column does not exist"** → Migration not applied
- **Webpack/Build errors** → Clear node_modules, reinstall

---

**Legend:**
- ⭐ = Critical test (must pass)
- ✅ = Expected/Fixed
- ❌ = Error state
