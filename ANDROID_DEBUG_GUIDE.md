# 🐛 ANDROID NOTIFICATIONS DEBUG GUIDE

## Issue Summary

**Working on Web:** ✅ Counter offers, notifications, real-time all working  
**Broken on Android APK:** ❌ No real-time notifications, no chat, no push

---

## Root Cause Analysis

### Issue 1: WebSocket Connections on Capacitor

**Problem:** Supabase realtime uses WebSockets, which behave differently on Capacitor/Android than on web browsers.

**Symptoms:**
- Real-time subscriptions silently fail
- No console errors (connection just doesn't establish)
- Works on web, fails on Android

**Fix Applied:** Added Capacitor-specific realtime configuration to `lib/supabase.ts`

---

### Issue 2: Push Notification Registration

**Problem:** Push tokens might not be registering or FCM might not be configured.

**Debug Steps:**

1. **Check if push registration runs:**
```
Look for in logcat:
[Push] Registration successful, token: ...
OR
[Push] Registration failed: ...
```

2. **Check if notifications are created in database:**
```sql
SELECT * FROM notifications 
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
```

3. **Check if realtime subscription connects:**
```
Look for in logcat:
[Realtime] Hybrid notification subscription status: SUBSCRIBED
```

---

## Diagnostic Steps

### Step 1: Check Logcat for Errors

```powershell
adb logcat | findstr "Realtime\|Push\|Notification\|Supabase"
```

**Look for:**
- `[Realtime] Subscription status: SUBSCRIBED` ✅
- `[Realtime] Error` or `WebSocket` errors ❌
- `[Push] Registration successful` ✅
- `[Push] Registration failed` ❌

---

### Step 2: Test Manually with Browser DevTools

Since it's a Capacitor app, you can inspect it:

```powershell
# Open Chrome
# Go to: chrome://inspect
# Click "inspect" on your app
```

This lets you see console logs in real-time!

---

### Step 3: Verify Realtime is Actually Enabled

In Supabase Dashboard:
1. Settings → Database → Replication
2. Check that `bids`, `notifications`, `jobs` are listed under "Tables"
3. If not, run `FIX_BIDDING_DATABASE.sql` again

---

### Step 4: Check Network Connectivity

The Android app might be blocking WebSocket connections.

**Test:**
```typescript
// Add this temporarily to App.tsx
useEffect(() => {
  fetch('https://your-project.supabase.co/rest/v1/')
    .then(() => console.log('✅ Network OK'))
    .catch(e => console.error('❌ Network FAIL:', e));
}, []);
```

---

## Common Issues & Fixes

### Issue: "WebSocket connection failed"

**Cause:** Android security policies block ws:// connections

**Fix:** Already added in `capacitor.config.ts`:
```typescript
server: {
  androidScheme: 'https',
  cleartext: true  // Allows WebSocket
}
```

---

### Issue: Push tokens not saving

**Check:**
```sql
SELECT id, name, push_token FROM profiles WHERE id = 'your-user-id';
```

**If null:**
1. Check notification permission was granted
2. Check google-services.json exists
3. Check FCM dependencies in build.gradle

---

### Issue: Notifications created but not appearing

**This means:**
- ✅ Triggers working
- ❌ Real-time subscription not working

**Debug:**
```typescript
// Add to UserContextDB after line 364:
console.log('[DEBUG] Is native?', Capacitor.isNativePlatform());
console.log('[DEBUG] User ID:', user.id);
console.log('[DEBUG] Supabase URL:', supabase.supabaseUrl);
```

---

## Quick Rebuild & Test

### Rebuild with fixes:

```powershell
# Apply code changes
npm run build

# Sync to Android
npx cap sync android

# Clean build
cd android
.\gradlew clean
.\gradlew assembleDebug  
cd ..

# Install
adb uninstall in.chowkar.app
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

### Test Notifications:

**Test 1: Create notification manually**
```sql
-- In Supabase SQL Editor
INSERT INTO notifications (user_id, title, message, type)
VALUES ('your-user-id-here', 'Test', 'Manual test notification', 'INFO');
```

Watch the app - should appear within 2 seconds.

**Test 2: Send message**
- Open chat on Device A
- Send message from Device B
- Device A should see message instantly

---

## Advanced Debugging

### Enable Verbose Logging

Add to `lib/supabase.ts`:

```typescript
// After supabase client creation
if (Capacitor.isNativePlatform()) {
  console.log('🔧 Supabase Client on Native Platform');
  console.log('URL:', supabaseUrl);
  console.log('Platform:', Capacitor.getPlatform());
  
  // Test realtime connection
  const testChannel = supabase.channel('test-connection');
  testChannel.subscribe((status) => {
    console.log('🔧 Test Channel Status:', status);
  });
  
  setTimeout(() => {
    supabase.removeChannel(testChannel);
  }, 5000);
}
```

### Check Capacitor Plugins

```powershell
npx cap ls
```

Should show:
- @capacitor/push-notifications ✅
- @capacitor/browser ✅
- @capacitor/app ✅

---

## Known Issues & Workarounds

### Issue: Realtime works on web, not on Android

**Workaround:** Use polling as fallback

```typescript
// In UserContextDB, add polling fallback:
useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;
  
  const pollInterval = setInterval(async () => {
    // Poll for new notifications every 10 seconds
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (data) {
      // Merge with existing
      setNotifications(prev => {
        const newNotifs = data.filter(n => !prev.some(p => p.id === n.id));
        return [...newNotifs.map(dbToApp), ...prev];
      });
    }
  }, 10000); // Poll every 10 seconds
  
  return () => clearInterval(pollInterval);
}, [user.id]);
```

---

## Expected Console Output (Working)

```
[Auth] Checking session directly...
[Auth] Direct session found: user@example.com
[Data] Fetching user data in parallel...
[Data] All user data loaded successfully
[Push] Registered successfully, token: eyJhbGciOiJSUz...
[Push] Token saved to database
[Realtime] Setting up HYBRID notification subscription
[Realtime] Hybrid Sync subscription status: SUBSCRIBED
[Realtime] Hybrid notification subscription status: SUBSCRIBED
```

## Failed Console Output (Broken)

```
[Auth] Direct session found: user@example.com
[Data] All user data loaded successfully
[Push] Registration failed: Permission denied
[Realtime] Setting up HYBRID notification subscription
[Realtime] Hybrid Sync subscription status: CHANNEL_ERROR
❌ WebSocket connection to 'wss://...' failed
```

---

## If Still Not Working

### Last Resort: Local Notification Fallback

For critical notifications (bid accepted, job completed), use Capacitor's Local Notifications as backup:

```typescript
import { LocalNotifications } from '@capacitor/local-notifications';

// When receiving important notification:
await LocalNotifications.schedule({
  notifications: [
    {
      title: notif.title,
      body: notif.message,
      id: Date.now(),
      schedule: { at: new Date(Date.now() + 1000) },
    }
  ]
});
```

This guarantees notifications even if push/realtime fails.

---

## Next Steps

1. **Rebuild app** with Supabase config fix
2. **Check logcat** for connection status
3. **Test manually** with SQL insert
4. **Report findings** - what errors do you see?

---

**Files Changed:**
- ✅ `lib/supabase.ts` - Added Capacitor realtime config

**Need to Rebuild:** YES

**Test Command:**
```powershell
adb logcat -c && adb logcat | findstr "Realtime\|Push"
```

Run this while testing to see what's happening!
