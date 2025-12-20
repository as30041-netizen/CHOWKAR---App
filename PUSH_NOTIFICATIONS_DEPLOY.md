# 🚀 PUSH NOTIFICATIONS - READY TO DEPLOY!

## ✅ All Changes Applied

### Files Modified:

1. **android/app/src/main/AndroidManifest.xml**
   - ✅ Added `POST_NOTIFICATIONS` permission

2. **android/app/build.gradle**
   - ✅ Added Firebase BOM and Messaging dependencies

3. **contexts/UserContextDB.tsx**
   - ✅ Added edge function call to send push notifications

### Already Configured:
- ✅ Edge function exists: `supabase/functions/send-push-notification/index.ts`
- ✅ Push service: `services/pushService.ts`
- ✅ Google services configured

---

## 🔧 Final Deployment Steps

### Step 1: Verify FCM_SERVER_KEY is Set

1. Go to **Firebase Console** → Your Project
2. Click ⚙️ Settings → Project Settings
3. Go to **Cloud Messaging** tab
4. Copy the **Server key** (starts with `AAAA...`)

5. Go to **Supabase Dashboard**
6. Navigate to **Settings** → **Edge Functions** → **Secrets**
7. Add new secret:
   - Key: `FCM_SERVER_KEY`
   - Value: (paste your server key)

### Step 2: Rebuild Android App

```powershell
# Navigate to project directory
cd "c:\Users\Abhishek Sharma\Documents\GitHub\CHOWKAR---App"

# Sync Capacitor with new Android changes
npx cap sync android

# Build APK
cd android
.\gradlew clean
.\gradlew assembleDebug
cd ..
```

### Step 3: Install and Test

```powershell
# Install APK
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 🧪 Testing Procedure

### Test 1: Notification Permission

1. **Install and open app**
2. **Grant notification permission** when prompted
3. **Check console logs:**
   ```
   [Push] Registration successful, token: eyJh...
   [Push] Token saved to database
   ```

### Test 2: Verify Token in Database

1. Go to **Supabase Dashboard** → SQL Editor
2. Run:
   ```sql
   SELECT 
     id, 
     name, 
     email,
     push_token IS NOT NULL as has_token,
     LEFT(push_token, 20) as token_preview
   FROM profiles
   WHERE push_token IS NOT NULL
   ORDER BY updated_at DESC;
   ```
3. **Verify your token appears**

### Test 3: Push When App is Open

1. Device A: Post a job
2. Device B: Place a bid
3. **Device A should:**
   - ✅ See in-app notification (real-time)
   - ✅ Console log: `[Push] Notification sent successfully to user: ...`

### Test 4: Push When App is Closed (KEY TEST!)

1. **Device A:** Post a job
2. **Device A:** **CLOSE the app completely** (swipe away from recents)
3. **Device B:** Place a bid
4. **Device A should:**
   - ✅ Receive Android notification in notification tray
   - ✅ Tap notification → app opens to View Bids

### Test 5: Multiple Notifications

1. Close app on Device A
2. Submit 3 bids from Device B
3. **Device A should:**
   - ✅ Receive 3 separate notifications
   - ✅ Each tap opens app to correct job

---

## 🐛 Troubleshooting

### Issue: No notification permission prompt

**Solution:**
- Uninstall app completely
- Reinstall APK
- Should prompt on first launch

### Issue: "No push token registered"

**Check 1:** Verify token in database:
```sql
SELECT push_token FROM profiles WHERE id = 'your-user-id';
```

**Check 2:** Look for registration errors in logcat:
```powershell
adb logcat | findstr "Push"
```

### Issue: Notifications work when app is open, not when closed

**Check 1:** Verify FCM_SERVER_KEY is set in Supabase

**Check 2:** Test edge function manually:
1. Go to Supabase Dashboard → Edge Functions
2. Select `send-push-notification`
3. Click "Run"
4. Test payload:
   ```json
   {
     "userId": "your-user-id-here",
     "title": "Test",
     "body": "Testing push notification"
   }
   ```

**Check 3:** Check edge function logs:
- Supabase Dashboard → Edge Functions → Logs
- Look for errors

### Issue: Edge function returns "User has no push token"

**Solution:**
1. Open app
2. Login
3. Wait for `[Push] Token saved to database`
4. Check database again

### Issue: FCM error "NotRegistered"

**Cause:** Token is invalid/expired

**Solution:**
1. Uninstall app
2. Delete token from database:
   ```sql
   UPDATE profiles 
   SET push_token = NULL 
   WHERE id = 'your-user-id';
   ```
3. Reinstall and login again

---

## 📊 How It Works

```
User B submits bid
        ↓
addNotification(userA, "New Bid", "...")
        ↓
    ┌───┴───┐
    ↓       ↓
DB Insert   Fetch /functions/v1/send-push-notification
            {userId, title, body, data}
                    ↓
            Edge Function gets push_token from DB
                    ↓
            Calls FCM API with token
                    ↓
            FCM sends push to device
                    ↓
        ┌───────┴──────┐
        ↓              ↓
    App Open?      App Closed?
        ↓              ↓
  Real-time      Android Notification
  (in-app)         (system tray)
```

---

## ✅ Verification Checklist

Before marking as complete, verify:

- [ ] `POST_NOTIFICATIONS` permission in AndroidManifest
- [ ] Firebase dependencies in build.gradle
- [ ] FCM_SERVER_KEY set in Supabase secrets
- [ ] Edge function deployed (check Supabase dashboard)
- [ ] App rebuilt with `npx cap sync && gradlew assembleDebug`
- [ ] App requests notification permission on first launch
- [ ] Token saves to database
- [ ] Push works when app is OPEN (in-app notification)
- [ ] Push works when app is CLOSED (Android notification tray)
- [ ] Tapping notification opens correct screen

---

## 🎯 Success Criteria

When everything is working, you'll see:

1. **On Login:**
   ```
   [Push] Registration successful, token: eyJh...
   [Push] Token saved to database
   ```

2. **When Notification Sent:**
   ```
   [Notification] DB insert success for user: xxx
   [Notification] Broadcast sent successfully
   [Push] Notification sent successfully to user: xxx
   ```

3. **On Device (app closed):**
   - Android notification appears in tray
   - Shows title and message
   - Tapping opens app

4. **In Supabase Edge Function Logs:**
   ```
   FCM Response: {success: 1, failure: 0}
   ```

---

## 🆘 Still Not Working?

If you've followed all steps and it's still not working:

1. **Check Supabase Edge Function Logs:**
   - Dashboard → Edge Functions → send-push-notification → Logs
   - Look for error messages

2. **Check Android Logcat:**
   ```powershell
   adb logcat | findstr "Firebase\|FCM\|Push"
   ```

3. **Verify google-services.json:**
   - Ensure it matches your Firebase project
   - Location: `android/app/google-services.json`

4. **Test with simple notification:**
   ```sql
   -- In Supabase SQL Editor
   INSERT INTO notifications (user_id, title, message, type)
   VALUES ('your-user-id', 'Test', 'Manual test', 'INFO');
   ```

---

## 🎉 You're Ready!

All code changes are complete. Now:

1. Set FCM_SERVER_KEY in Supabase
2. Rebuild app: `npx cap sync && .\gradlew assembleDebug`
3. Test on device
4. Enjoy push notifications! 🔔

Good luck! 🚀
