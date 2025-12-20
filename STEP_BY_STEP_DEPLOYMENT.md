# 🚀 Complete Deployment Guide - Real-Time Bids & Push Notifications

## Overview
This guide will help you deploy:
1. ✅ Real-time bid updates (bids appear instantly in modal)
2. ✅ Push notifications (notifications when app is closed)

**Total Time:** ~15-20 minutes

---

## 📋 Pre-Flight Checklist

Before starting, ensure you have:
- [ ] Supabase account with access to your project
- [ ] Firebase project with Cloud Messaging enabled
- [ ] Android device or emulator for testing
- [ ] Terminal/PowerShell open

---

## PART 1: Database Setup (5 minutes)

### Step 1: Get FCM Server Key

1. **Open Firebase Console:**
   - Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Select your CHOWKAR project

2. **Navigate to Cloud Messaging:**
   - Click ⚙️ (Settings) → **Project settings**
   - Click **Cloud Messaging** tab

3. **Copy Server Key:**
   - Find "Server key" (starts with `AAAA...`)
   - Click the copy icon
   - **Keep this handy - you'll need it in Step 3**

---

### Step 2: Enable Real-Time for Bids Table

1. **Open Supabase Dashboard:**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your CHOWKAR project

2. **Open SQL Editor:**
   - Click **SQL Editor** in the left sidebar
   - Click **New query**

3. **Run Real-Time Setup Script:**
   - Open file: `ENABLE_REALTIME_BIDS.sql` in your project
   - **Copy ALL contents** (Ctrl+A, Ctrl+C)
   - **Paste into Supabase SQL Editor**
   - Click **Run** (or press F5)

4. **Verify Success:**
   - You should see messages like:
     ```
     ✅ Realtime enabled for bids, notifications, and jobs tables
     ✅ Bid notification trigger created
     ```
   - Scroll down and check the verification results show all 3 tables

**✅ Checkpoint:** Bids table now has real-time enabled!

---

### Step 3: Configure Push Notification Secret

1. **Still in Supabase Dashboard:**
   - Click **Settings** (bottom left)
   - Click **Edge Functions**
   - Click **Secrets** tab

2. **Add FCM Server Key:**
   - Click **+ New Secret**
   - **Name:** `FCM_SERVER_KEY`
   - **Value:** Paste the server key you copied in Step 1
   - Click **Insert secret**

3. **Verify:**
   - You should see `FCM_SERVER_KEY` in the secrets list with value hidden (••••••)

**✅ Checkpoint:** Edge function can now send push notifications!

---

## PART 2: Build Android App (10 minutes)

### Step 4: Sync Capacitor

1. **Open PowerShell/Terminal:**
   - Press `Win + X` → **Windows PowerShell**
   - Navigate to your project:
     ```powershell
     cd "c:\Users\Abhishek Sharma\Documents\GitHub\CHOWKAR---App"
     ```

2. **Sync Capacitor:**
   ```powershell
   npx cap sync android
   ```

3. **Wait for completion:**
   - This will copy web assets to Android
   - Should take 30-60 seconds
   - Look for "✔ Copying web assets from build to android\app\src\main\assets\public"

**✅ Checkpoint:** Android project is synced!

---

### Step 5: Clean and Build APK

1. **Navigate to Android folder:**
   ```powershell
   cd android
   ```

2. **Clean previous builds:**
   ```powershell
   .\gradlew clean
   ```
   - Wait for "BUILD SUCCESSFUL"

3. **Build debug APK:**
   ```powershell
   .\gradlew assembleDebug
   ```
   - This will take 2-5 minutes
   - You'll see:
     ```
     > Task :app:assembleDebug
     BUILD SUCCESSFUL in Xm Xs
     ```

4. **Return to project root:**
   ```powershell
   cd ..
   ```

**✅ Checkpoint:** APK built successfully!

**APK Location:** `android\app\build\outputs\apk\debug\app-debug.apk`

---

## PART 3: Install & Test (5 minutes)

### Step 6: Install APK on Device

**Option A: Using USB Cable**

1. **Connect your Android phone:**
   - Enable USB Debugging on phone:
     - Settings → About Phone → Tap "Build number" 7 times
     - Settings → Developer Options → Enable "USB Debugging"
   - Connect via USB cable
   - Allow debugging when prompted on phone

2. **Install APK:**
   ```powershell
   adb install android\app\build\outputs\apk\debug\app-debug.apk
   ```
   - If you see "INSTALL_FAILED_UPDATE_INCOMPATIBLE", uninstall old version first:
     ```powershell
     adb uninstall in.chowkar.app
     adb install android\app\build\outputs\apk\debug\app-debug.apk
     ```

**Option B: Transfer APK Manually**

1. **Copy APK to phone:**
   - Connect phone via USB in File Transfer mode
   - Copy `android\app\build\outputs\apk\debug\app-debug.apk` to phone's Downloads folder

2. **Install on phone:**
   - Open "Files" app on phone
   - Navigate to Downloads
   - Tap `app-debug.apk`
   - Tap "Install"
   - Allow "Install from unknown sources" if prompted

**✅ Checkpoint:** App installed on device!

---

### Step 7: First Launch - Grant Permissions

1. **Open CHOWKAR app on your phone**

2. **Grant Notification Permission:**
   - When prompted "Allow CHOWKAR to send you notifications?"
   - Tap **"Allow"**
   - ⚠️ This is CRITICAL for push notifications!

3. **Login with Google:**
   - Tap "Get Started"
   - Sign in with Google account

4. **Watch for console confirmation:**
   - If using `adb`, run:
     ```powershell
     adb logcat | findstr "Push"
     ```
   - Look for: `[Push] Registration successful, token: ...`
   - This means push is working!

**✅ Checkpoint:** App is running with push enabled!

---

## PART 4: Testing (5 minutes)

### Test 1: Real-Time Bid Updates

**Setup:**
- Device A: Your phone (logged in as User A)
- Device B: Browser/emulator (logged in as User B)

**Steps:**

1. **Device A (Phone):**
   - Post a new job
   - Tap "View Bids" (should show 0 bids)
   - **Keep this modal open**

2. **Device B (Browser):**
   - Find the job in the list
   - Submit a bid

3. **Device A (Phone):**
   - **WITHOUT CLOSING OR REFRESHING**
   - ✅ Bid should appear instantly in the modal
   - ✅ Bid count should update: "(0)" → "(1)"

**Expected Result:**
- Bid appears within 2 seconds
- No need to close and reopen modal
- Notification bell also shows +1

---

### Test 2: Push Notifications (App Closed)

**Steps:**

1. **Device A (Phone):**
   - Post a job
   - **CLOSE THE APP COMPLETELY:**
     - Press Home button
     - Swipe up to open Recents
     - Swipe CHOWKAR away to close it
   - Lock phone or use another app

2. **Device B (Browser):**
   - Submit a bid on that job

3. **Device A (Phone):**
   - **Check notification tray** (swipe down from top)
   - ✅ Should see Android notification:
     ```
     CHOWKAR
     New Bid
     New bid of ₹500 from [Worker Name] on "[Job Title]"
     ```

4. **Tap the notification:**
   - ✅ App should open
   - ✅ Should show the job's bids

**Expected Result:**
- Notification appears within 5 seconds
- Tapping opens app to correct screen

---

### Test 3: In-App Notifications

**Steps:**

1. **Device A (Phone):**
   - Post a job
   - **Minimize app** (don't close, just press Home)

2. **Device B (Browser):**
   - Submit a bid

3. **Device A (Phone):**
   - **Open CHOWKAR app**
   - ✅ Notification bell should show "+1"
   - Tap bell
   - ✅ Should see "New Bid" notification
   - Tap notification
   - ✅ Opens View Bids modal with the new bid

**Expected Result:**
- Both in-app AND push notification work

---

## 🎯 Success Criteria

You've successfully deployed when:

- [ ] Database real-time enabled (verified in Step 2)
- [ ] FCM_SERVER_KEY configured (verified in Step 3)
- [ ] App built without errors (verified in Step 5)
- [ ] App installed on device (verified in Step 6)
- [ ] Notification permission granted (verified in Step 7)
- [ ] **TEST 1 PASSED:** Bids appear instantly in modal
- [ ] **TEST 2 PASSED:** Push notification when app closed
- [ ] **TEST 3 PASSED:** In-app notifications work

---

## 🐛 Troubleshooting

### Issue: "npx cap sync" fails

**Error:** `Command failed with exit code 1`

**Solution:**
```powershell
npm install
npx cap sync android
```

---

### Issue: Gradle build fails

**Error:** `Could not resolve all files for configuration`

**Solution:**
```powershell
cd android
.\gradlew clean --refresh-dependencies
.\gradlew assembleDebug
cd ..
```

---

### Issue: No notification permission prompt

**Solution:**
- Uninstall app completely:
  ```powershell
  adb uninstall in.chowkar.app
  ```
- Reinstall and launch - should prompt

---

### Issue: Push token not saving

**Check database:**

1. Go to Supabase Dashboard → SQL Editor
2. Run:
   ```sql
   SELECT id, name, push_token 
   FROM profiles 
   WHERE push_token IS NOT NULL;
   ```

**If empty:**
- Check logcat for errors:
  ```powershell
  adb logcat | findstr "Push\|Firebase"
  ```

---

### Issue: Real-time bids not working

**Check 1:** Verify realtime is enabled:

```sql
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'bids';
```

**If empty:** Re-run `ENABLE_REALTIME_BIDS.sql`

**Check 2:** Check browser console:
- Open DevTools (F12) in browser
- Look for: `[ViewBidsModal] Bid change detected`

---

### Issue: Push notifications not appearing

**Check 1:** Verify secret is set:
- Supabase → Settings → Edge Functions → Secrets
- Should see `FCM_SERVER_KEY`

**Check 2:** Test edge function manually:
1. Supabase Dashboard → Edge Functions
2. Click `send-push-notification`
3. Click "Invoke"
4. Paste:
   ```json
   {
     "userId": "your-user-id-from-database",
     "title": "Test",
     "body": "Testing push"
   }
   ```
5. Click "Run"

**Check 3:** View edge function logs:
- Same page, click "Logs" tab
- Look for errors

---

## 📱 Quick Reference Commands

**Build APK:**
```powershell
cd "c:\Users\Abhishek Sharma\Documents\GitHub\CHOWKAR---App"
npx cap sync android
cd android
.\gradlew clean assembleDebug
cd ..
```

**Install APK:**
```powershell
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

**View logs:**
```powershell
adb logcat | findstr "Push\|ViewBids\|Notification"
```

**Uninstall app:**
```powershell
adb uninstall in.chowkar.app
```

---

## 🎉 You're Done!

Once all tests pass, you have:

✅ Real-time bid updates working  
✅ Push notifications when app closed  
✅ In-app notifications when app open  
✅ Proper Android permissions  
✅ Production-ready APK  

**Next Steps:**
- Test with multiple users
- Monitor Supabase edge function logs
- When ready, create signed release APK for Play Store

---

## 💡 Pro Tips

1. **Monitor in real-time:**
   - Keep `adb logcat` running during tests
   - Watch for `[Push]` and `[ViewBidsModal]` logs

2. **Clear app data between tests:**
   ```powershell
   adb shell pm clear in.chowkar.app
   ```

3. **Check notification settings:**
   - Phone Settings → Apps → CHOWKAR → Notifications
   - Ensure all notification categories are enabled

4. **Battery optimization:**
   - Some phones kill background apps aggressively
   - Go to: Phone Settings → Battery → CHOWKAR → "Unrestricted"

---

**Need Help?**

Check these files for detailed information:
- `ENABLE_REALTIME_BIDS.sql` - Database setup
- `PUSH_NOTIFICATIONS_DEPLOY.md` - Detailed push guide
- `REALTIME_BIDS_FIX.md` - Real-time implementation details
- `PUSH_NOTIFICATION_COMPLETE_FIX.md` - Complete analysis

Good luck! 🚀
